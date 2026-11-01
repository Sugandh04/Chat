import { Router, type Request, type Response } from "express";
import { storage } from "../config/storage.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Apply non-blocking auth middleware
router.use(requireAuth);

function getCurrentUser(req: Request) {
  const userId = req.currentUserId || req.session?.userId || "user-sugan";
  const user = storage.getUserById(userId) || {
    id: userId,
    displayName: req.currentUserName || "User",
    avatar: "👤",
    status: "online" as const,
    lastSeen: new Date().toISOString(),
  };
  return user;
}

// ==========================================
// CHANNELS
// ==========================================

// GET /api/chats/channels
router.get("/channels", (_req: Request, res: Response) => {
  const channels = storage.getChannels();
  res.json({ channels });
});

// POST /api/chats/channels
router.post("/channels", (req: Request, res: Response) => {
  const { name, description } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ message: "Channel name is required" });
    return;
  }

  const channel = storage.createChannel(name, description);
  res.status(201).json({ channel });
});

// GET /api/chats/channels/:channelId/messages
router.get("/channels/:channelId/messages", (req: Request, res: Response) => {
  const channelId = req.params.channelId;
  const limit = Math.min(Number(req.query.limit ?? 100), 100);
  const before = req.query.before ? String(req.query.before) : undefined;

  const result = storage.getMessages(channelId, limit, before);
  res.json(result);
});

// POST /api/chats/channels/:channelId/messages
router.post("/channels/:channelId/messages", (req: Request, res: Response) => {
  const channelId = req.params.channelId;
  const user = getCurrentUser(req);
  const { text, mediaUrl } = req.body ?? {};

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ message: "Message cannot be empty" });
    return;
  }

  const message = storage.addMessage({
    targetId: channelId,
    senderId: user.id,
    senderName: user.displayName,
    senderAvatar: user.avatar,
    text: text.trim(),
    mediaUrl: typeof mediaUrl === "string" ? mediaUrl : undefined,
  });

  res.status(201).json({ message });
});

// ==========================================
// USERS & DIRECT CONVERSATIONS
// ==========================================

// GET /api/chats/users
router.get("/users", (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const users = storage.getUsers().filter((u) => u.id !== user.id);
  res.json({ users });
});

// GET /api/chats/conversations
router.get("/conversations", (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const conversations = storage.getConversations(user.id);
  res.json({ conversations });
});

// POST /api/chats/conversations
router.post("/conversations", (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { participantId } = req.body ?? {};

  if (!participantId || typeof participantId !== "string") {
    res.status(400).json({ message: "Participant ID is required" });
    return;
  }

  const otherUser = storage.getUserById(participantId);
  if (!otherUser) {
    res.status(404).json({ message: "Participant not found" });
    return;
  }

  const conversationId = `dm:${[user.id, participantId].sort().join(":")}`;
  res.status(200).json({
    conversation: {
      id: conversationId,
      participant: otherUser,
      lastMessageAt: new Date().toISOString(),
    },
  });
});

// GET /api/chats/conversations/:conversationId/messages
router.get("/conversations/:conversationId/messages", (req: Request, res: Response) => {
  const conversationId = req.params.conversationId;
  const limit = Math.min(Number(req.query.limit ?? 100), 100);
  const before = req.query.before ? String(req.query.before) : undefined;

  const result = storage.getMessages(conversationId, limit, before);
  res.json(result);
});

// POST /api/chats/conversations/:conversationId/messages
router.post("/conversations/:conversationId/messages", (req: Request, res: Response) => {
  const conversationId = req.params.conversationId;
  const user = getCurrentUser(req);
  const { text, mediaUrl } = req.body ?? {};

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ message: "Message cannot be empty" });
    return;
  }

  const message = storage.addMessage({
    targetId: conversationId,
    senderId: user.id,
    senderName: user.displayName,
    senderAvatar: user.avatar,
    text: text.trim(),
    mediaUrl: typeof mediaUrl === "string" ? mediaUrl : undefined,
  });

  res.status(201).json({ message });
});

// ==========================================
// REACTIONS & MESSAGE ACTIONS
// ==========================================

// POST /api/chats/messages/:messageId/reaction
router.post("/messages/:messageId/reaction", (req: Request, res: Response) => {
  const messageId = req.params.messageId;
  const user = getCurrentUser(req);
  const { emoji } = req.body ?? {};

  if (!emoji || typeof emoji !== "string") {
    res.status(400).json({ message: "Emoji is required" });
    return;
  }

  const updated = storage.toggleReaction(messageId, emoji, user.id);
  if (!updated) {
    res.status(404).json({ message: "Message not found" });
    return;
  }

  res.json({ message: updated });
});

// DELETE /api/chats/messages/:messageId
router.delete("/messages/:messageId", (req: Request, res: Response) => {
  const messageId = req.params.messageId;
  const deleted = storage.deleteMessage(messageId);

  if (!deleted) {
    res.status(404).json({ message: "Message not found" });
    return;
  }

  res.json({ message: "Message deleted" });
});

export default router;
