import "dotenv/config";
import express, {} from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import inviteRoutes from "./routes/invites.js";
import chatRoutes from "./routes/chats.js";
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 5000);
const clientUrl = process.env.CLIENT_URL;
const mongoUrl = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;
if (!clientUrl || !mongoUrl || !sessionSecret) {
    throw new Error("CLIENT_URL, MONGODB_URI and SESSION_SECRET must be configured");
}
if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port");
}
if (isProduction) {
    app.set("trust proxy", 1);
}
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
    origin: clientUrl,
    credentials: true,
}));
app.use(express.json({ limit: "16kb" }));
app.use(session({
    name: "connect.sid",
    secret: sessionSecret,
    store: MongoStore.create({
        mongoUrl,
        collectionName: "sessions",
        ttl: 60 * 60 * 24,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24,
        path: "/",
    },
}));
app.get("/api/health", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "unavailable",
        database: connected ? "connected" : "disconnected",
    });
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});
const inviteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/invites", inviteLimiter, inviteRoutes);
app.use("/api/chats", chatLimiter, chatRoutes);
app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
});
app.use((error, _req, res, _next) => {
    console.error("Request failed:", error);
    if (res.headersSent)
        return;
    res.status(500).json({
        message: "Internal server error",
    });
});
async function startServer() {
    await connectDB();
    const server = app.listen(port, () => {
        console.log(`API running at http://localhost:${port}`);
    });
    let shuttingDown = false;
    const shutdown = () => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        console.log("Shutting down server...");
        server.close(() => {
            void mongoose.disconnect().finally(() => process.exit(0));
        });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map