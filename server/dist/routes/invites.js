import { Router } from "express";
import { createHash, randomBytes, timingSafeEqual, } from "node:crypto";
import { Invite } from "../models/Invite.js";
const router = Router();
// POST /api/invites
router.post("/", async (req, res, next) => {
    try {
        const expectedSecret = process.env.ADMIN_SECRET;
        const suppliedSecret = req.header("x-admin-secret") ?? "";
        if (!expectedSecret) {
            res.status(503).json({
                message: "Invite administration unavailable",
            });
            return;
        }
        const supplied = Buffer.from(suppliedSecret);
        const expected = Buffer.from(expectedSecret);
        if (supplied.length !== expected.length ||
            !timingSafeEqual(supplied, expected)) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        const token = randomBytes(32).toString("hex");
        const invite = await Invite.create({
            tokenHash: createHash("sha256")
                .update(token)
                .digest("hex"),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        res.status(201).json({
            inviteUrl: `${process.env.CLIENT_URL}/register?token=${token}`,
            expiresAt: invite.expiresAt,
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=invites.js.map