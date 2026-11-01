import "dotenv/config";
import http from "node:http";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import { Server as SocketIOServer } from "socket.io";

import { connectDB, isMongoDBConnected } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import inviteRoutes from "./routes/invites.js";
import chatRoutes from "./routes/chats.js";
import { setupChatSockets } from "./sockets/chatSocket.js";

const app = express();
const httpServer = http.createServer(app);

// Trust the first proxy hop (Render / Railway / etc. sit behind a load balancer).
// Without this, express-session won't set secure cookies correctly.
app.set("trust proxy", 1);

const port = Number(process.env.PORT ?? 5000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

// Detect whether we are running in production (HTTPS).
const isProduction = process.env.NODE_ENV === "production";

const sessionSecret = process.env.SESSION_SECRET;
const mongoUri = process.env.MONGODB_URI;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is missing from environment variables.");
}

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing from environment variables.");
}

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: [clientUrl, "http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Shared session configuration for Express and Socket.IO.
const sessionMiddleware = session({
  name: "connect.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: "sessions",
    ttl: 60 * 60 * 24 * 7,
  }),
  cookie: {
    httpOnly: true,
    // In production (HTTPS) cookies must be secure=true and sameSite=none
    // so they are sent on cross-origin requests (Vercel → Render).
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  },
});

app.use(sessionMiddleware);

// Socket.IO configuration.
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [clientUrl, "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Share Express sessions with Socket.IO connections.
io.engine.use(sessionMiddleware);

setupChatSockets(io);

// Health check.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    database: isMongoDBConnected
      ? "mongodb-connected"
      : "disconnected",
    sockets: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

// API routes.
app.use("/api/auth", authRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/chats", chatRoutes);

// 404 handler.
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// Global error handler.
app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error("[Server] Request failed:", error);

    if (res.headersSent) return;

    res.status(500).json({
      message: "Internal server error",
    });
  }
);

// Start server only after MongoDB connects.
async function startServer(): Promise<void> {
  try {
    await connectDB();

    httpServer.listen(port, () => {
      console.log("-----------------------------------------");
      console.log(`Server running at http://localhost:${port}`);
      console.log(`Frontend: ${clientUrl}`);
      console.log("MongoDB connected");
      console.log("Session storage: MongoDB");
      console.log("Socket.IO ready");
      console.log("-----------------------------------------");
    });
  } catch (error) {
    console.error("[Server] Startup failed:", error);
    process.exit(1);
  }
}

// Local development startup.
void startServer();

export default app;
