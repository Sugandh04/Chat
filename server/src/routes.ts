import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { isValidObjectId } from "mongoose";
import type { Server } from "socket.io";
import { AuthedRequest, requireAdmin, requireAuth, signToken } from "./auth.js";
import { Conversation, Invite, Message, User } from "./models.js";

const publicUser = (u: any) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function serializeChat(c: any, userId: string) {
  await c.populate("members", "name email");
  const last = await Message.findOne({ conversation: c._id }).sort({ createdAt: -1 });
  const members = c.members.map((m: any) => ({ id: String(m._id), name: m.name }));
  const other = members.find((m: any) => m.id !== userId);
  return {
    id: String(c._id),
    type: c.type,
    title: c.type === "group" ? c.name : other?.name ?? "Unknown",
    members,
    lastMessage: last ? { text: last.text, sender: String(last.sender), createdAt: last.createdAt } : null,
    lastMessageAt: c.lastMessageAt,
  };
}

const serializeMessage = (m: any) => ({
  id: String(m._id),
  chatId: String(m.conversation),
  sender: String(m.sender),
  text: m.text,
  createdAt: m.createdAt,
});

export function buildRouter(io: Server) {
  const r = Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

  r.get("/health", (_req, res) => void res.json({ ok: true }));

  r.post("/auth/register", authLimiter, async (req, res) => {
    const name = str(req.body.name, 60);
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const code = str(req.body.inviteCode, 100);
    if (!name || !EMAIL.test(email) || password.length < 8 || password.length > 128)
      return void res.status(400).json({ error: "Enter a name, a valid email and a password of at least 8 characters." });
    if (await User.exists({ email })) return void res.status(409).json({ error: "This email is already registered." });

    let role: "admin" | "member" = "member";
    let invite: any = null;
    const isFirst = (await User.estimatedDocumentCount()) === 0;
    if (isFirst && process.env.ADMIN_SECRET && code === process.env.ADMIN_SECRET) {
      role = "admin";
    } else {
      invite = await Invite.findOne({ code, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
      if (!invite || (invite.email && invite.email !== email))
        return void res.status(403).json({ error: "This invite is invalid or has expired." });
    }
    const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
    if (invite) {
      invite.usedBy = user._id;
      invite.usedAt = new Date();
      await invite.save();
    }
    res.status(201).json({ token: signToken(String(user._id)), user: publicUser(user) });
  });

  r.post("/auth/login", authLimiter, async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) return void res.status(401).json({ error: "Incorrect email or password." });
    res.json({ token: signToken(String(user._id)), user: publicUser(user) });
  });

  r.use(requireAuth);

  r.get("/me", async (req, res) => {
    const user = await User.findById((req as AuthedRequest).userId);
    res.json({ user: publicUser(user) });
  });

  r.patch("/me", async (req, res) => {
    const name = str(req.body.name, 60);
    if (!name) return void res.status(400).json({ error: "Name is required." });
    const user = await User.findByIdAndUpdate((req as AuthedRequest).userId, { name }, { new: true });
    res.json({ user: publicUser(user) });
  });

  r.get("/users", async (_req, res) => {
    const users = await User.find().sort({ name: 1 });
    res.json({ users: users.map(publicUser) });
  });

  r.post("/invites", requireAdmin, async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    if (email && !EMAIL.test(email)) return void res.status(400).json({ error: "Invalid email." });
    const code = crypto.randomBytes(12).toString("hex");
    const invite = await Invite.create({
      code,
      email: email || undefined,
      createdBy: (req as AuthedRequest).userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    res.status(201).json({ invite: { code, email: invite.email ?? null, expiresAt: invite.expiresAt } });
  });

  r.get("/invites", requireAdmin, async (_req, res) => {
    const list = await Invite.find().sort({ createdAt: -1 }).limit(50);
    res.json({
      invites: list.map((i) => ({
        code: i.code,
        email: i.email ?? null,
        used: !!i.usedAt,
        expired: !i.usedAt && i.expiresAt < new Date(),
        expiresAt: i.expiresAt,
      })),
    });
  });

  r.get("/chats", async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const chats = await Conversation.find({ members: userId }).sort({ lastMessageAt: -1 });
    res.json({ chats: await Promise.all(chats.map((c) => serializeChat(c, userId))) });
  });

  r.post("/chats", async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const type = req.body.type === "group" ? "group" : "direct";
    const raw: unknown[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const ids = [...new Set(raw.filter((x): x is string => typeof x === "string" && isValidObjectId(x)))].filter(
      (x) => x !== userId
    );
    if ((await User.countDocuments({ _id: { $in: ids } })) !== ids.length)
      return void res.status(400).json({ error: "Unknown member." });

    let chat: any;
    if (type === "direct") {
      if (ids.length !== 1) return void res.status(400).json({ error: "Choose one person." });
      const directKey = [userId, ids[0]].sort().join(":");
      chat = await Conversation.findOne({ directKey });
      if (!chat) chat = await Conversation.create({ type, members: [userId, ids[0]], createdBy: userId, directKey });
    } else {
      const name = str(req.body.name, 80);
      if (!name || ids.length < 1)
        return void res.status(400).json({ error: "A group needs a name and at least one other member." });
      chat = await Conversation.create({ type, name, members: [userId, ...ids], createdBy: userId });
    }
    for (const m of chat.members) io.to(`user:${m}`).emit("chat", { chatId: String(chat._id) });
    res.status(201).json({ chat: await serializeChat(chat, userId) });
  });

  async function memberChat(req: any, res: any) {
    const id = req.params.id;
    if (!isValidObjectId(id)) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
    const chat = await Conversation.findOne({ _id: id, members: (req as any as AuthedRequest).userId });
    if (!chat) res.status(404).json({ error: "Not found" });
    return chat;
  }

  r.get("/chats/:id/messages", async (req, res) => {
    const chat = await memberChat(req, res);
    if (!chat) return;
    const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
    const filter: any = { conversation: chat._id };
    if (before && !isNaN(+before)) filter.createdAt = { $lt: before };
    const msgs = await Message.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ messages: msgs.map(serializeMessage) });
  });

  r.post("/chats/:id/messages", async (req, res) => {
    const chat = await memberChat(req, res);
    if (!chat) return;
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 4000) return void res.status(400).json({ error: "Message must be 1 to 4000 characters." });
    const msg = await Message.create({ conversation: chat._id, sender: (req as unknown as AuthedRequest).userId, text });
    chat.lastMessageAt = (msg as any).createdAt;
    await chat.save();
    const payload = serializeMessage(msg);
    for (const m of chat.members) io.to(`user:${m}`).emit("message", payload);
    res.status(201).json({ message: payload });
  });

  return r;
}
