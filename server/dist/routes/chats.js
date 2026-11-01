import { Router } from "express";
import mongoose, { Types } from "mongoose";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
// Get authenticated user's MongoDB ID.
function getUserId(req) {
    return new Types.ObjectId(req.currentUserId);
}
// Validate MongoDB ObjectId.
function isValidId(id) {
    return typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
}
// ==========================================
// USERS
// ==========================================
// GET /api/chats/users
router.get("/users", async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const users = await User.find({
            _id: { $ne: userId },
        })
            .select("_id displayName email")
            .sort({ displayName: 1 })
            .lean();
        res.json({
            users: users.map((user) => ({
                id: user._id.toString(),
                displayName: user.displayName,
                email: user.email,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// CONVERSATIONS
// ==========================================
// GET /api/chats/conversations
router.get("/conversations", async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const conversations = await Conversation.find({
            participants: userId,
        })
            .sort({ lastMessageAt: -1 })
            .lean();
        const otherUserIds = conversations
            .flatMap((conversation) => conversation.participants)
            .filter((id) => !id.equals(userId));
        const otherUsers = await User.find({
            _id: { $in: otherUserIds },
        })
            .select("_id displayName email")
            .lean();
        const userMap = new Map(otherUsers.map((user) => [user._id.toString(), user]));
        res.json({
            conversations: conversations.map((conversation) => {
                const otherParticipantId = conversation.participants.find((id) => !id.equals(userId));
                const otherParticipant = otherParticipantId
                    ? userMap.get(otherParticipantId.toString())
                    : undefined;
                return {
                    id: conversation._id.toString(),
                    participant: otherParticipant
                        ? {
                            id: otherParticipant._id.toString(),
                            displayName: otherParticipant.displayName,
                            email: otherParticipant.email,
                        }
                        : null,
                    lastMessageAt: conversation.lastMessageAt,
                };
            }),
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/chats/conversations
router.post("/conversations", async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const { participantId } = req.body ?? {};
        if (!isValidId(participantId)) {
            res.status(400).json({
                message: "A valid participant ID is required.",
            });
            return;
        }
        const otherUserId = new Types.ObjectId(participantId);
        if (userId.equals(otherUserId)) {
            res.status(400).json({
                message: "You cannot start a conversation with yourself.",
            });
            return;
        }
        const otherUser = await User.findById(otherUserId)
            .select("_id displayName email")
            .lean();
        if (!otherUser) {
            res.status(404).json({
                message: "Participant not found.",
            });
            return;
        }
        // Sort IDs to ensure A-B and B-A produce the same key.
        const participantIds = [
            userId.toString(),
            otherUserId.toString(),
        ].sort();
        const participantKey = participantIds.join(":");
        let conversation;
        try {
            conversation = await Conversation.findOneAndUpdate({ participantKey }, {
                $setOnInsert: {
                    participants: participantIds.map((id) => new Types.ObjectId(id)),
                    participantKey,
                    lastMessageAt: new Date(),
                },
            }, {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            });
        }
        catch (error) {
            if (typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === 11000) {
                conversation = await Conversation.findOne({
                    participantKey,
                });
            }
            else {
                throw error;
            }
        }
        if (!conversation) {
            res.status(500).json({
                message: "Unable to create conversation.",
            });
            return;
        }
        res.status(200).json({
            conversation: {
                id: conversation._id.toString(),
                participant: {
                    id: otherUser._id.toString(),
                    displayName: otherUser.displayName,
                    email: otherUser.email,
                },
                lastMessageAt: conversation.lastMessageAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// MESSAGES
// ==========================================
// GET /api/chats/conversations/:conversationId/messages
router.get("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const conversationId = req.params.conversationId;
        if (!isValidId(conversationId)) {
            res.status(400).json({
                message: "Invalid conversation ID.",
            });
            return;
        }
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        });
        if (!conversation) {
            res.status(404).json({
                message: "Conversation not found.",
            });
            return;
        }
        const rawLimit = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(rawLimit)
            ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
            : 50;
        const before = req.query.before
            ? String(req.query.before)
            : undefined;
        const messageFilter = {
            conversationId: conversation._id,
        };
        if (before) {
            if (!isValidId(before)) {
                res.status(400).json({
                    message: "Invalid pagination cursor.",
                });
                return;
            }
            const cursor = await Message.findOne({
                _id: before,
                conversationId: conversation._id,
            }).select("_id createdAt");
            if (!cursor) {
                res.status(400).json({
                    message: "Invalid pagination cursor.",
                });
                return;
            }
            messageFilter.$or = [
                { createdAt: { $lt: cursor.createdAt } },
                {
                    createdAt: cursor.createdAt,
                    _id: { $lt: cursor._id },
                },
            ];
        }
        const results = await Message.find(messageFilter)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean();
        const hasMore = results.length > limit;
        const messages = results.slice(0, limit).reverse();
        // Fetch sender details separately to avoid populated-document
        // TypeScript inference problems.
        const senderIds = [
            ...new Set(messages.map((message) => message.senderId.toString())),
        ];
        const senders = await User.find({
            _id: { $in: senderIds },
        })
            .select("_id displayName")
            .lean();
        const senderMap = new Map(senders.map((sender) => [sender._id.toString(), sender]));
        res.json({
            messages: messages.map((message) => {
                const sender = senderMap.get(message.senderId.toString());
                return {
                    id: message._id.toString(),
                    conversationId: message.conversationId.toString(),
                    sender: sender
                        ? {
                            id: sender._id.toString(),
                            displayName: sender.displayName,
                        }
                        : null,
                    text: message.text,
                    createdAt: message.createdAt,
                };
            }),
            hasMore,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/chats/conversations/:conversationId/messages
router.post("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const conversationId = req.params.conversationId;
        const { text } = req.body ?? {};
        if (!isValidId(conversationId)) {
            res.status(400).json({
                message: "Invalid conversation ID.",
            });
            return;
        }
        if (typeof text !== "string" || !text.trim()) {
            res.status(400).json({
                message: "Message cannot be empty.",
            });
            return;
        }
        const cleanText = text.trim();
        if (cleanText.length > 4000) {
            res.status(400).json({
                message: "Message cannot exceed 4000 characters.",
            });
            return;
        }
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        });
        if (!conversation) {
            res.status(404).json({
                message: "Conversation not found.",
            });
            return;
        }
        const message = await Message.create({
            conversationId: conversation._id,
            senderId: userId,
            text: cleanText,
        });
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();
        res.status(201).json({
            message: {
                id: message._id.toString(),
                conversationId: message.conversationId.toString(),
                sender: {
                    id: userId.toString(),
                    displayName: req.currentUserName,
                },
                text: message.text,
                createdAt: message.createdAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// DELETE MESSAGE
// ==========================================
// DELETE /api/chats/messages/:messageId
router.delete("/messages/:messageId", async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const messageId = req.params.messageId;
        if (!isValidId(messageId)) {
            res.status(400).json({
                message: "Invalid message ID.",
            });
            return;
        }
        const message = await Message.findOneAndDelete({
            _id: messageId,
            senderId: userId,
        });
        if (!message) {
            res.status(404).json({
                message: "Message not found or you cannot delete it.",
            });
            return;
        }
        // Refresh the conversation's latest message timestamp.
        const latestMessage = await Message.findOne({
            conversationId: message.conversationId,
        })
            .sort({ createdAt: -1, _id: -1 })
            .select("createdAt");
        await Conversation.updateOne({ _id: message.conversationId }, {
            $set: {
                lastMessageAt: latestMessage?.createdAt ?? message.createdAt,
            },
        });
        res.json({
            message: "Message deleted successfully.",
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=chats.js.map