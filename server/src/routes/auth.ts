import { Router, type Request, type Response } from "express";
import { storage } from "../config/storage.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/auth/me
// Returns current active profile; never blocks with 401
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const userId = req.currentUserId || req.session?.userId || "user-sugan";
  const user = storage.getUserById(userId) || storage.upsertUser({
    id: userId,
    displayName: req.currentUserName || "Guest User",
    avatar: "⚡",
    status: "online",
  });

  res.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      status: user.status,
      email: user.email,
    },
  });
});

// POST /api/auth/login (or instant join/profile update)
// Auth is disabled: simply set your display name & avatar and enter
router.post("/login", (req: Request, res: Response) => {
  const { displayName, avatar, userId } = req.body ?? {};

  const cleanName = typeof displayName === "string" && displayName.trim()
    ? displayName.trim().slice(0, 40)
    : "Guest " + Math.floor(100 + Math.random() * 900);

  const cleanId = typeof userId === "string" && userId.trim()
    ? userId.trim()
    : "user-" + Math.random().toString(36).substring(2, 8);

  const cleanAvatar = typeof avatar === "string" && avatar ? avatar : "👤";

  const user = storage.upsertUser({
    id: cleanId,
    displayName: cleanName,
    avatar: cleanAvatar,
    status: "online",
  });

  if (req.session) {
    req.session.userId = user.id;
  }

  res.json({
    message: "Welcome to PulseChat!",
    user: {
      id: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      status: user.status,
    },
  });
});

// POST /api/auth/register
// Backward compatibility: acts as instant join without requiring invite token or password
router.post("/register", (req: Request, res: Response) => {
  const { displayName, avatar } = req.body ?? {};

  const cleanName = typeof displayName === "string" && displayName.trim()
    ? displayName.trim()
    : "New User";

  const cleanId = "user-" + Math.random().toString(36).substring(2, 8);
  const user = storage.upsertUser({
    id: cleanId,
    displayName: cleanName,
    avatar: avatar || "🚀",
    status: "online",
  });

  if (req.session) {
    req.session.userId = user.id;
  }

  res.status(201).json({
    message: "Profile created successfully!",
    user,
  });
});

// POST /api/auth/profile
// Update user display name and avatar on the fly
router.post("/profile", requireAuth, (req: Request, res: Response) => {
  const userId = req.currentUserId || "user-sugan";
  const { displayName, avatar } = req.body ?? {};

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    res.status(400).json({ message: "Display name cannot be empty" });
    return;
  }

  const updated = storage.upsertUser({
    id: userId,
    displayName: displayName.trim().slice(0, 40),
    avatar: avatar || "✨",
    status: "online",
  });

  res.json({
    message: "Profile updated",
    user: updated,
  });
});

// POST /api/auth/logout
router.post("/logout", (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy(() => {});
  }
  res.clearCookie("connect.sid");
  res.status(200).json({ message: "Logged out" });
});

export default router;
