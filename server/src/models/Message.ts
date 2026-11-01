import { Schema, model, Document, Model, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000,
    },
  },
  { timestamps: true }
);

messageSchema.index({
  conversationId: 1,
  createdAt: -1,
  _id: -1,
});

export const Message: Model<IMessage> = model<IMessage>(
  "Message",
  messageSchema
);
