import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { Server } from "socket.io";

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
io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
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
const port = Number(process.env.PORT) || 5000;
server.listen(port, () => console.log(`API listening on ${port}`));
