import { Schema, model, Document, Model } from "mongoose";
const inviteSchema = new Schema({
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        select: false,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    usedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });
inviteSchema.index({ expiresAt: 1 });
export const Invite = model("Invite", inviteSchema);
//# sourceMappingURL=Invite.js.map