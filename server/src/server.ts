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

// Trust the first proxy hop (Render / Railway / etc. sit behind reverse proxies).
// Without this, express-session won't set secure cookies correctly.
app.set("trust proxy", 1);

const port = Number(process.env.PORT ?? 5000);

// Detect production / Render hosting
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.RENDER === "true" ||
  Boolean(process.env.RENDER_EXTERNAL_URL);

const sessionSecret = process.env.SESSION_SECRET;
const mongoUri = process.env.MONGODB_URI;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is missing from environment variables.");
}

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing from environment variables.");
}

// Check whether an incoming request origin should be allowed
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // allow tools, mobile, curl, server-to-server

  const clean = origin.trim().replace(/\/+$/, "").toLowerCase();

  // 1. Explicit environment variable if configured
  if (process.env.CLIENT_URL) {
    const envClean = process.env.CLIENT_URL.trim().replace(/\/+$/, "").toLowerCase();
    if (clean === envClean) return true;
  }

  // 2. Specific known Vercel frontend URL
  if (clean === "https://chat-lyart-rho.vercel.app") return true;

  // 3. Any Vercel preview or production deployment
  if (clean.endsWith(".vercel.app")) return true;

  // 4. Local development
  if (
    clean.startsWith("http://localhost:") ||
    clean.startsWith("http://127.0.0.1:")
  ) {
    return true;
  }

  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-admin-secret",
  ],
};

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors(corsOptions));
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
    // so they are sent on cross-origin requests (Vercel -> Render).
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
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed by Socket CORS"));
      }
    },
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
      message: error instanceof Error ? error.message : "Internal server error",
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
      console.log(`Mode: ${isProduction ? "production" : "development"}`);
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
