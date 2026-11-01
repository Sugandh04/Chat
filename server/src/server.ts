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
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";

import { connectDB, isMongoDBConnected } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import inviteRoutes from "./routes/invites.js";
import chatRoutes from "./routes/chats.js";
import { setupChatSockets } from "./sockets/chatSocket.js";

const app = express();
const httpServer = http.createServer(app);

const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 5000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const sessionSecret = process.env.SESSION_SECRET || "default_development_session_secret_32_chars_long";

if (isProduction) {
  app.set("trust proxy", 1);
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
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matching clientUrl / localhost
      if (!origin || origin === clientUrl || origin.startsWith("http://localhost:")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Session handling with in-memory store for instant zero-dependency execution
app.use(
  session({
    name: "connect.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    },
  })
);

// Setup Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [clientUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

setupChatSockets(io);

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    database: isMongoDBConnected ? "mongodb-connected" : "local-storage-active",
    sockets: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/chats", chatRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error("Request failed:", error);

    if (res.headersSent) return;

    res.status(500).json({
      message: "Internal server error",
    });
  }
);

async function startServer(): Promise<void> {
  // Start HTTP and WebSocket server immediately so app is always responsive
  httpServer.listen(port, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 PulseChat Server running at http://localhost:${port}`);
    console.log(`🔌 WebSockets active & listening`);
    console.log(`🌐 Client expected at ${clientUrl}`);
    console.log(`=========================================\n`);
  });

  // Connect to DB asynchronously in background
  void connectDB();

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("Shutting down server...");
    httpServer.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
