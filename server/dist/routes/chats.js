import { Router } from "express";
import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
function getCurrentUserId(req) {
    return req.session.userId ?? null;
}
function isValidObjectId(id) {
    return Types.ObjectId.isValid(id);
}
// GET /api/chats/users
// List users available to start a conversation with.
router.get("/users", async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId || !isValidObjectId(userId)) {
            res.status(401).json({ message: "Please log in" });
            return;
        }
        const users = await User.find({
            _id: { $ne: new Types.ObjectId(userId) },
        })
            .select("_id displayName")
            .sort({ displayName: 1 })
            .limit(200)
            .lean();
        res.json({
            users: users.map((user) => ({
                id: user._id.toString(),
                displayName: user.displayName,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/chats/conversations
// List the current user's conversations.
router.get("/conversations", async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId || !isValidObjectId(userId)) {
            res.status(401).json({ message: "Please log in" });
            return;
        }
        const conversations = await Conversation.find({
            participants: new Types.ObjectId(userId),
        })
            .sort({ lastMessageAt: -1 })
            .exec();
        const results = await Promise.all(conversations.map(async (conversation) => {
            const otherParticipantId = conversation.participants.find((participantId) => participantId.toString() !== userId);
            if (!otherParticipantId) {
                return null;
            }
            const [otherUser, lastMessage] = await Promise.all([
                User.findById(otherParticipantId)
                    .select("_id displayName")
                    .lean(),
                Message.findOne({
                    conversationId: conversation._id,
                })
                    .sort({ createdAt: -1, _id: -1 })
                    .lean(),
            ]);
            if (!otherUser) {
                return null;
            }
            return {
                id: conversation._id.toString(),
                participant: {
                    id: otherUser._id.toString(),
                    displayName: otherUser.displayName,
                },
                lastMessage: lastMessage
                    ? {
                        id: lastMessage._id.toString(),
                        senderId: lastMessage.senderId.toString(),
                        text: lastMessage.text,
                        createdAt: lastMessage.createdAt,
                    }
                    : null,
                lastMessageAt: conversation.lastMessageAt,
            };
        }));
        res.json({
            conversations: results.filter((conversation) => conversation !== null),
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/chats/conversations
// Create a conversation or return the existing one.
router.post("/conversations", async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId || !isValidObjectId(userId)) {
            res.status(401).json({ message: "Please log in" });
            return;
        }
        const { participantId } = req.body ?? {};
        if (typeof participantId !== "string" ||
            !isValidObjectId(participantId) ||
            participantId === userId) {
            res.status(400).json({
                message: "Invalid conversation participant",
            });
            return;
        }
        const otherUser = await User.findById(participantId)
            .select("_id displayName")
            .lean();
        if (!otherUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const participantIds = [userId, participantId].sort();
        const participantKey = participantIds.join(":");
        let conversation = await Conversation.findOne({
            participantKey,
        });
        if (!conversation) {
            try {
                conversation = await Conversation.create({
                    participants: participantIds.map((id) => new Types.ObjectId(id)),
                    participantKey,
                    lastMessageAt: new Date(),
                });
            }
            catch (error) {
                // A concurrent request may have created this conversation.
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
        }
        if (!conversation) {
            res.status(500).json({
                message: "Unable to open conversation",
            });
            return;
        }
        res.status(200).json({
            conversation: {
                id: conversation._id.toString(),
                participant: {
                    id: otherUser._id.toString(),
                    displayName: otherUser.displayName,
                },
                lastMessageAt: conversation.lastMessageAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/chats/conversations/:conversationId/messages
// Fetch a page of messages. Use `before` for older messages.
router.get("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const conversationId = String(req.params.conversationId);
        if (!userId || !isValidObjectId(userId)) {
            res.status(401).json({ message: "Please log in" });
            return;
        }
        if (!isValidObjectId(conversationId)) {
            res.status(400).json({
                message: "Invalid conversation ID",
            });
            return;
        }
        const conversation = await Conversation.findOne({
            _id: new Types.ObjectId(conversationId),
            participants: new Types.ObjectId(userId),
        });
        if (!conversation) {
            res.status(404).json({
                message: "Conversation not found",
            });
            return;
        }
        const requestedLimit = Number(req.query.limit ?? 50);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;
        let query = Message.find({
            conversationId: conversation._id,
        });
        if (req.query.before !== undefined) {
            const before = new Date(String(req.query.before));
            if (Number.isNaN(before.getTime())) {
                res.status(400).json({
                    message: "Invalid before timestamp",
                });
                return;
            }
            query = query.where("createdAt").lt(before.getTime());
        }
        const rows = await query
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .exec();
        const hasMore = rows.length > limit;
        const page = rows.slice(0, limit).reverse();
        res.json({
            messages: page.map((message) => ({
                id: message._id.toString(),
                conversationId: message.conversationId.toString(),
                senderId: message.senderId.toString(),
                text: message.text,
                createdAt: message.createdAt,
            })),
            hasMore,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/chats/conversations/:conversationId/messages
// Send a message.
router.post("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const conversationId = String(req.params.conversationId);
        if (!userId || !isValidObjectId(userId)) {
            res.status(401).json({ message: "Please log in" });
            return;
        }
        if (!isValidObjectId(conversationId)) {
            res.status(400).json({
                message: "Invalid conversation ID",
            });
            return;
        }
        const { text } = req.body ?? {};
        if (typeof text !== "string" ||
            text.trim().length === 0 ||
            text.trim().length > 4000) {
            res.status(400).json({
                message: "Message must contain 1–4000 characters",
            });
            return;
        }
        const conversation = await Conversation.findOne({
            _id: new Types.ObjectId(conversationId),
            participants: new Types.ObjectId(userId),
        });
        if (!conversation) {
            res.status(404).json({
                message: "Conversation not found",
            });
            return;
        }
        const message = await Message.create({
            conversationId: conversation._id,
            senderId: new Types.ObjectId(userId),
            text: text.trim(),
        });
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();
        res.status(201).json({
            message: {
                id: message._id.toString(),
                conversationId: message.conversationId.toString(),
                senderId: message.senderId.toString(),
                text: message.text,
                createdAt: message.createdAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=chats.js.map