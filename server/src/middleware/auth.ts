import type { Request, Response, NextFunction } from "express";
import { storage } from "../config/storage.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      currentUserId?: string;
      currentUserName?: string;
    }
  }
}

/**
 * Permissive authentication middleware.
 * Authentication is disabled - anyone can access, post messages, and read chats.
 * If user identification header or session exists, it will be used;
 * otherwise an automatic guest identity is assigned seamlessly.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // 1. Check custom headers
  const headerUserId = req.header("x-user-id");
  const headerUserName = req.header("x-user-name");

  // 2. Check session
  const sessionUserId = req.session?.userId;

  let userId = headerUserId || sessionUserId;
  let userName = headerUserName;

  if (!userId) {
    // Generate or use guest ID
    userId = "guest-" + (req.ip || "user").replace(/[^a-zA-Z0-9]/g, "").slice(-6);
  }

  if (!userName) {
    const existing = storage.getUserById(userId);
    userName = existing?.displayName || `User-${userId.slice(-4)}`;
  }

  // Ensure user is registered in storage
  storage.upsertUser({
    id: userId,
    displayName: userName,
    status: "online",
  });

  req.currentUserId = userId;
  req.currentUserName = userName;

  if (req.session) {
    req.session.userId = userId;
  }

  next();
}
