import { Schema, model, Document, Model, Types } from "mongoose";

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  participantKey: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      required: true,
      validate: {
        validator: (ids: unknown[]) =>
          Array.isArray(ids) &&
          ids.length === 2 &&
          String(ids[0]) !== String(ids[1]),
        message: "A conversation must have two distinct participants",
      },
    },
    participantKey: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

conversationSchema.index({
  participants: 1,
  lastMessageAt: -1,
});

export const Conversation: Model<IConversation> = model<IConversation>(
  "Conversation",
  conversationSchema
);
