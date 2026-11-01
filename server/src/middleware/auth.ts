import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";

// Extend Express session
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      currentUserId?: string;
      currentUserName?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check whether a session exists
    const userId = req.session?.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({
        message: "Authentication required. Please log in.",
      });
      return;
    }

    // 2. Find the authenticated user in MongoDB
    const user = await User.findById(userId)
      .select("_id displayName")
      .lean();

    if (!user) {
      // User no longer exists; invalidate the session
      req.session.destroy(() => { });

      res.status(401).json({
        message: "User account not found. Please log in again.",
      });
      return;
    }

    // 3. Attach authenticated user details to the request
    req.currentUserId = user._id.toString();
    req.currentUserName = user.displayName;

    // 4. Continue to the requested route
    next();
  } catch (error) {
    console.error("[Authentication] Error:", error);

    res.status(500).json({
      message: "Authentication failed due to a server error.",
    });
  }
}