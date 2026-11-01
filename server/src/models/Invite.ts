import { Schema, model, Document, Model } from "mongoose";

export interface IInvite extends Document {
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
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
  },
  { timestamps: true }
);

inviteSchema.index({ expiresAt: 1 });

export const Invite: Model<IInvite> = model<IInvite>("Invite", inviteSchema);
