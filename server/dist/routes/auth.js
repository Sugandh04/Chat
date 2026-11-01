import { Router } from "express";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { User } from "../models/User.js";
import { Invite } from "../models/Invite.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}
function isDuplicateKeyError(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000);
}
// POST /api/auth/register
router.post("/register", async (req, res, next) => {
    try {
        const { displayName, email, password, inviteToken } = req.body ?? {};
        if (typeof displayName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof inviteToken !== "string" ||
            displayName.trim().length < 2 ||
            displayName.trim().length > 50 ||
            email.trim().length === 0 ||
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 1024 ||
            !/^[a-f0-9]{64}$/i.test(inviteToken)) {
            res.status(400).json({
                message: "Invalid registration details",
            });
            return;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const invite = await Invite.findOne({
            tokenHash: hashToken(inviteToken),
            usedAt: null,
            expiresAt: { $gt: new Date() },
        }).select("+tokenHash");
        if (!invite) {
            res.status(400).json({
                message: "Invitation is invalid, expired, or already used",
            });
            return;
        }
        const existingUser = await User.exists({
            email: normalizedEmail,
        });
        if (existingUser) {
            res.status(409).json({
                message: "Unable to create account with these details",
            });
            return;
        }
        const passwordHash = await argon2.hash(password);
        const user = await User.create({
            displayName: displayName.trim(),
            email: normalizedEmail,
            passwordHash,
        });
        // Claim the invitation only if it is still unused and valid.
        const claimedInvite = await Invite.updateOne({
            _id: invite._id,
            usedAt: null,
            expiresAt: { $gt: new Date() },
        }, { $set: { usedAt: new Date() } });
        if (claimedInvite.modifiedCount !== 1) {
            await User.deleteOne({ _id: user._id });
            res.status(400).json({
                message: "Invitation is invalid, expired, or already used",
            });
            return;
        }
        res.status(201).json({
            message: "Account created. Please log in.",
        });
    }
    catch (error) {
        if (isDuplicateKeyError(error)) {
            res.status(409).json({
                message: "Unable to create account with these details",
            });
            return;
        }
        next(error);
    }
});
// POST /api/auth/login
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body ?? {};
        if (typeof email !== "string" ||
            typeof password !== "string" ||
            email.trim().length === 0 ||
            email.length > 254 ||
            Buffer.byteLength(password, "utf8") > 1024) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }
        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+passwordHash");
        let validPassword = false;
        if (user) {
            validPassword = await argon2
                .verify(user.passwordHash, password)
                .catch(() => false);
        }
        if (!user || !validPassword) {
            res.status(401).json({
                message: "Invalid email or password",
            });
            return;
        }
        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        req.session.userId = user.id;
        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        res.json({
            user: {
                id: user.id,
                displayName: user.displayName,
                email: user.email,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/logout
router.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            next(error);
            return;
        }
        res.clearCookie("connect.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });
        res.status(204).end();
    });
});
// GET /api/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            res.status(401).json({ message: "Please log in" });
            return;
        }
        const user = await User.findById(userId).select("_id displayName email");
        if (!user) {
            req.session.destroy(() => { });
            res.status(401).json({ message: "Please log in" });
            return;
        }
        res.json({
            user: {
                id: user.id,
                displayName: user.displayName,
                email: user.email,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=auth.js.map