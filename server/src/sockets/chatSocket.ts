import { Server as SocketIOServer, Socket } from "socket.io";
import { storage } from "../config/storage.js";

interface ActiveSocketUser {
  socketId: string;
  userId: string;
  displayName: string;
  avatar: string;
}

const activeSockets = new Map<string, ActiveSocketUser>();

export function setupChatSockets(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Register active user
    socket.on("user_connected", (userData: { userId: string; displayName: string; avatar?: string }) => {
      if (!userData?.userId) return;

      activeSockets.set(socket.id, {
        socketId: socket.id,
        userId: userData.userId,
        displayName: userData.displayName || "Anonymous",
        avatar: userData.avatar || "👤",
      });

      storage.setUserStatus(userData.userId, "online");

      // Broadcast presence update
      io.emit("presence_update", {
        users: storage.getUsers(),
        onlineUserIds: Array.from(activeSockets.values()).map((u) => u.userId),
      });
    });

    // Join a channel or conversation room
    socket.on("join_channel", ({ targetId }: { targetId: string }) => {
      if (!targetId) return;
      const room = `room:${targetId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room ${room}`);
    });

    // Leave a room
    socket.on("leave_channel", ({ targetId }: { targetId: string }) => {
      if (!targetId) return;
      socket.leave(`room:${targetId}`);
    });

    // Typing start
    socket.on("typing_start", ({ targetId, userName }: { targetId: string; userName: string }) => {
      if (!targetId) return;
      socket.to(`room:${targetId}`).emit("user_typing", {
        targetId,
        userName,
      });
    });

    // Typing stop
    socket.on("typing_stop", ({ targetId, userName }: { targetId: string; userName: string }) => {
      if (!targetId) return;
      socket.to(`room:${targetId}`).emit("user_stop_typing", {
        targetId,
        userName,
      });
    });

    // Send Message
    socket.on(
      "send_message",
      async (msgData: {
        targetId: string;
        text: string;
        senderId: string;
        senderName: string;
        senderAvatar?: string;
        mediaUrl?: string;
      }) => {
        if (!msgData?.targetId || !msgData?.text?.trim()) return;

        const message = storage.addMessage({
          targetId: msgData.targetId,
          senderId: msgData.senderId || "user-sugan",
          senderName: msgData.senderName || "Sugan",
          senderAvatar: msgData.senderAvatar || "⚡",
          text: msgData.text.trim(),
          mediaUrl: msgData.mediaUrl,
        });

        // Broadcast to everyone in the room
        io.to(`room:${msgData.targetId}`).emit("new_message", message);

        // If user chats in general or mentions bot, trigger a friendly response
        if (msgData.text.toLowerCase().includes("@spark") || msgData.text.toLowerCase().includes("bot")) {
          setTimeout(() => {
            const botReplies = [
              "I'm here! Everything is running in real-time with WebSockets! ⚡",
              "Looking great! You can react to messages with emojis or switch channels anytime.",
              "PulseChat is fully operational. Try sharing an emoji or starting a direct message! 🚀",
              "Real-time sync confirmed! Feel free to create new channels with the + button.",
            ];
            const replyText = botReplies[Math.floor(Math.random() * botReplies.length)];
            const botMsg = storage.addMessage({
              targetId: msgData.targetId,
              senderId: "bot-spark",
              senderName: "Spark AI",
              senderAvatar: "🤖",
              text: replyText,
            });
            io.to(`room:${msgData.targetId}`).emit("new_message", botMsg);
          }, 800);
        }
      }
    );

    // Toggle reaction
    socket.on(
      "toggle_reaction",
      ({
        messageId,
        emoji,
        userId,
        targetId,
      }: {
        messageId: string;
        emoji: string;
        userId: string;
        targetId: string;
      }) => {
        if (!messageId || !emoji || !userId) return;

        const updated = storage.toggleReaction(messageId, emoji, userId);
        if (updated && targetId) {
          io.to(`room:${targetId}`).emit("reaction_updated", {
            messageId,
            reactions: updated.reactions,
          });
        }
      }
    );

    // Delete message
    socket.on("delete_message", ({ messageId, targetId }: { messageId: string; targetId: string }) => {
      if (!messageId) return;
      const success = storage.deleteMessage(messageId);
      if (success && targetId) {
        io.to(`room:${targetId}`).emit("message_deleted", { messageId });
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      const activeUser = activeSockets.get(socket.id);
      if (activeUser) {
        activeSockets.delete(socket.id);

        // Check if user has other tabs open
        const stillConnected = Array.from(activeSockets.values()).some((u) => u.userId === activeUser.userId);
        if (!stillConnected) {
          storage.setUserStatus(activeUser.userId, "offline");
        }

        io.emit("presence_update", {
          users: storage.getUsers(),
          onlineUserIds: Array.from(activeSockets.values()).map((u) => u.userId),
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}
