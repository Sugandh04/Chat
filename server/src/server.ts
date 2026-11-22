import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { Conversation, User } from "./models.js";

const origins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
const corsOrigin = (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) =>
  cb(null, !origin || origins.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));

const { verifyToken } = await import("./auth.js");
const { buildRouter } = await import("./routes.js");

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "20kb" }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin } });

io.use((socket, next) => {
  const id = verifyToken(String(socket.handshake.auth?.token || ""));
  if (!id) return next(new Error("unauthorized"));
  socket.data.userId = id;
  next();
});
// Calls: the server only relays signalling between the two members of a direct chat.
const CALL_TYPES = new Set(["invite", "accept", "decline", "end", "offer", "answer", "ice"]);
io.on("connection", (socket) => {
  const me = String(socket.data.userId);
  socket.join(`user:${me}`);
  const allowed = new Map<string, boolean>();
  socket.on("call", async (p: Record<string, unknown>) => {
    try {
      const type = String(p?.type);
      const chatId = String(p?.chatId);
      const to = String(p?.to);
      if (!CALL_TYPES.has(type) || to === me) return;
      const key = `${chatId}:${to}`;
      if (!allowed.has(key)) {
        allowed.set(key, !!(await Conversation.exists({ _id: chatId, type: "direct", members: { $all: [me, to] } })));
      }
      if (!allowed.get(key)) return;
      io.to(`user:${to}`).emit("call", {
        type,
        chatId,
        callId: String(p.callId || "").slice(0, 64),
        from: me,
        video: !!p.video,
        data: p.data ?? null,
      });
    } catch {
      /* ignore malformed signalling */
    }
  });
});

app.get("/", (_req, res) => void res.json({ ok: true }));
app.use("/api", buildRouter(io));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");
await mongoose.connect(uri);

// Bring accounts from the previous app into the new shape, and make sure an admin exists.
await User.updateMany({ name: { $exists: false }, displayName: { $exists: true } }, [{ $set: { name: "$displayName" } }], { updatePipeline: true });
await User.updateMany({ role: { $exists: false } }, { $set: { role: "member" } });
if (!(await User.exists({ role: "admin" }))) {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const target = email ? await User.findOne({ email }) : await User.findOne().sort({ createdAt: 1 });
  if (target) {
    target.role = "admin";
    await target.save();
    console.log(`Admin set to ${target.email}`);
  }
}
const port = Number(process.env.PORT) || 5000;
server.listen(port, () => console.log(`API listening on ${port}`));
