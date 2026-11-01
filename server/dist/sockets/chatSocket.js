import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
const activeSockets = new Map();
function getOnlineUserIds() {
    return [
        ...new Set(Array.from(activeSockets.values()).map((activeUser) => activeUser.userId)),
    ];
}
function isValidConversationId(id) {
    return (typeof id === "string" &&
        /^[a-f\d]{24}$/i.test(id));
}
export function setupChatSockets(io) {
    io.on("connection", async (socket) => {
        try {
            // Authenticate using the shared Express session.
            const session = socket.request.session;
            const userId = session?.userId;
            if (!userId || !mongoose.isValidObjectId(userId)) {
                socket.disconnect(true);
                return;
            }
            const user = await User.findById(userId)
                .select("_id displayName")
                .lean();
            if (!user) {
                socket.disconnect(true);
                return;
            }
            const authenticatedUserId = user._id.toString();
            activeSockets.set(socket.id, {
                socketId: socket.id,
                userId: authenticatedUserId,
                displayName: user.displayName,
            });
            console.log(`[Socket] ${user.displayName} connected`);
            io.emit("presence_update", {
                onlineUserIds: getOnlineUserIds(),
            });
            // ==========================================
            // JOIN CONVERSATION
            // ==========================================
            socket.on("join_conversation", async (data) => {
                try {
                    const conversationId = data?.conversationId;
                    if (!isValidConversationId(conversationId))
                        return;
                    const conversation = await Conversation.findOne({
                        _id: conversationId,
                        participants: authenticatedUserId,
                    }).select("_id");
                    if (!conversation) {
                        socket.emit("socket_error", {
                            message: "You are not a participant in this conversation.",
                        });
                        return;
                    }
                    await socket.join(`conversation:${conversationId}`);
                    socket.emit("conversation_joined", {
                        conversationId,
                    });
                }
                catch (error) {
                    console.error("[Socket] Join conversation failed:", error);
                }
            });
            // ==========================================
            // LEAVE CONVERSATION
            // ==========================================
            socket.on("leave_conversation", async (data) => {
                const conversationId = data?.conversationId;
                if (!isValidConversationId(conversationId))
                    return;
                await socket.leave(`conversation:${conversationId}`);
            });
            // ==========================================
            // TYPING INDICATORS
            // ==========================================
            socket.on("typing_start", async (data) => {
                try {
                    const conversationId = data?.conversationId;
                    if (!isValidConversationId(conversationId))
                        return;
                    const isMember = await Conversation.exists({
                        _id: conversationId,
                        participants: authenticatedUserId,
                    });
                    if (!isMember)
                        return;
                    socket.to(`conversation:${conversationId}`).emit("user_typing", {
                        conversationId,
                        userId: authenticatedUserId,
                        displayName: user.displayName,
                    });
                }
                catch (error) {
                    console.error("[Socket] Typing start failed:", error);
                }
            });
            socket.on("typing_stop", async (data) => {
                try {
                    const conversationId = data?.conversationId;
                    if (!isValidConversationId(conversationId))
                        return;
                    const isMember = await Conversation.exists({
                        _id: conversationId,
                        participants: authenticatedUserId,
                    });
                    if (!isMember)
                        return;
                    socket.to(`conversation:${conversationId}`).emit("user_stop_typing", {
                        conversationId,
                        userId: authenticatedUserId,
                    });
                }
                catch (error) {
                    console.error("[Socket] Typing stop failed:", error);
                }
            });
            // ==========================================
            // SEND MESSAGE
            // ==========================================
            socket.on("send_message", async (data, callback) => {
                try {
                    const conversationId = data?.conversationId;
                    const text = typeof data?.text === "string" ? data.text.trim() : "";
                    if (!isValidConversationId(conversationId)) {
                        callback?.({
                            success: false,
                            error: "Invalid conversation.",
                        });
                        return;
                    }
                    if (!text || text.length > 4000) {
                        callback?.({
                            success: false,
                            error: "Message must contain 1–4000 characters.",
                        });
                        return;
                    }
                    const conversation = await Conversation.findOne({
                        _id: conversationId,
                        participants: authenticatedUserId,
                    });
                    if (!conversation) {
                        callback?.({
                            success: false,
                            error: "Conversation not found or access denied.",
                        });
                        return;
                    }
                    const message = await Message.create({
                        conversationId: conversation._id,
                        senderId: authenticatedUserId,
                        text,
                    });
                    await Conversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: message.createdAt } });
                    const messagePayload = {
                        id: message._id.toString(),
                        conversationId: conversation._id.toString(),
                        senderId: authenticatedUserId,
                        text: message.text,
                        createdAt: message.createdAt,
                    };
                    io.to(`conversation:${conversationId}`).emit("new_message", messagePayload);
                    callback?.({
                        success: true,
                        message: messagePayload,
                    });
                }
                catch (error) {
                    console.error("[Socket] Send message failed:", error);
                    callback?.({
                        success: false,
                        error: "Unable to send message.",
                    });
                }
            });
            // ==========================================
            // DISCONNECT
            // ==========================================
            socket.on("disconnect", () => {
                activeSockets.delete(socket.id);
                const stillConnected = Array.from(activeSockets.values()).some((activeUser) => activeUser.userId === authenticatedUserId);
                if (!stillConnected) {
                    io.emit("presence_update", {
                        onlineUserIds: getOnlineUserIds(),
                    });
                }
                console.log(`[Socket] ${user.displayName} disconnected`);
            });
        }
        catch (error) {
            console.error("[Socket] Authentication failed:", error);
            socket.disconnect(true);
        }
    });
}
//# sourceMappingURL=chatSocket.js.map