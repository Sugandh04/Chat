import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";

import { User } from "../models/User.js";
import { Invite } from "../models/Invite.js";

const router = Router();

// Rate limiting for authentication endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later.",
  },
});

// Regenerate the session and authenticate the user.
function createAuthenticatedSession(
  req: Request,
  userId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      req.session.userId = userId;

      req.session.save((saveError) => {
        if (saveError) {
          reject(saveError);
          return;
        }

        resolve();
      });
    });
  });
}

// GET /api/auth/me
router.get(
  "/me",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.userId;

      if (!userId || !mongoose.isValidObjectId(userId)) {
        res.status(401).json({ message: "Please log in." });
        return;
      }

      const user = await User.findById(userId)
        .select("_id displayName email createdAt")
        .lean();

      if (!user) {
        req.session.destroy(() => { });
        res.status(401).json({
          message: "User not found. Please log in again.",
        });
        return;
      }

      res.json({
        user: {
          id: user._id.toString(),
          displayName: user.displayName,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/register
router.post(
  "/register",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    let claimedInviteId: mongoose.Types.ObjectId | null = null;
    let accountCreated = false;

    try {
      const { displayName, email, password, token } = req.body ?? {};

      if (
        typeof displayName !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        typeof token !== "string"
      ) {
        res.status(400).json({
          message: "All registration fields are required.",
        });
        return;
      }

      const cleanName = displayName.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (cleanName.length < 2 || cleanName.length > 50) {
        res.status(400).json({
          message: "Display name must be 2–50 characters.",
        });
        return;
      }

      if (password.length < 8 || password.length > 128) {
        res.status(400).json({
          message: "Password must be 8–128 characters.",
        });
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({
          message: "Enter a valid email address.",
        });
        return;
      }

      if (!/^[a-f0-9]{64}$/i.test(token)) {
        res.status(400).json({
          message: "Invalid invitation token.",
        });
        return;
      }

      // Hash the invitation token before looking it up.
      const tokenHash = createHash("sha256")
        .update(token)
        .digest("hex");

      // Atomically claim an unused, unexpired invitation.
      const invite = await Invite.findOneAndUpdate(
        {
          tokenHash,
          usedAt: null,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { usedAt: new Date() },
        },
        {
          new: true,
        }
      );

      if (!invite) {
        res.status(400).json({
          message: "Invitation is invalid, expired, or already used.",
        });
        return;
      }

      claimedInviteId = invite._id;

      const existingUser = await User.findOne({
        email: cleanEmail,
      }).lean();

      if (existingUser) {
        await Invite.updateOne(
          { _id: invite._id, usedAt: invite.usedAt },
          { $set: { usedAt: null } }
        );

        claimedInviteId = null;

        res.status(409).json({
          message: "An account with this email already exists.",
        });
        return;
      }

      const passwordHash = await argon2.hash(password);

      const user = await User.create({
        displayName: cleanName,
        email: cleanEmail,
        passwordHash,
      });

      accountCreated = true;

      // Authenticate the newly registered user.
      await createAuthenticatedSession(req, user._id.toString());

      res.status(201).json({
        message: "Account created successfully.",
        user: {
          id: user._id.toString(),
          displayName: user.displayName,
          email: user.email,
        },
      });
    } catch (error) {
      // Restore the invitation only if account creation did not succeed.
      if (claimedInviteId && !accountCreated) {
        try {
          await Invite.updateOne(
            {
              _id: claimedInviteId,
              usedAt: { $ne: null },
            },
            {
              $set: { usedAt: null },
            }
          );
        } catch (restoreError) {
          console.error(
            "[Auth] Failed to restore invitation:",
            restoreError
          );
        }
      }

      next(error);
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body ?? {};

      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
      ) {
        res.status(400).json({
          message: "Email and password are required.",
        });
        return;
      }

      const user = await User.findOne({
        email: email.trim().toLowerCase(),
      }).select("+passwordHash");

      if (!user) {
        res.status(401).json({
          message: "Invalid email or password.",
        });
        return;
      }

      const passwordMatches = await argon2.verify(
        user.passwordHash,
        password
      );

      if (!passwordMatches) {
        res.status(401).json({
          message: "Invalid email or password.",
        });
        return;
      }

      await createAuthenticatedSession(req, user._id.toString());

      res.json({
        message: "Login successful.",
        user: {
          id: user._id.toString(),
          displayName: user.displayName,
          email: user.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout
router.post(
  "/logout",
  (req: Request, res: Response, next: NextFunction) => {
    req.session.destroy((error) => {
      if (error) {
        next(error);
        return;
      }

      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });

      res.json({
        message: "Logged out successfully.",
      });
    });
  }
);

export default router;