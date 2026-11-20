import mongoose, { Schema } from "mongoose";

const user = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
  },
  { timestamps: true }
);

const invite = new Schema(
  {
    code: { type: String, required: true, unique: true },
    email: { type: String, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usedBy: { type: Schema.Types.ObjectId, ref: "User" },
    usedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const conversation = new Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String, trim: true, maxlength: 80 },
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    directKey: { type: String, unique: true, sparse: true },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
conversation.index({ members: 1, lastMessageAt: -1 });

const message = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
message.index({ conversation: 1, createdAt: -1 });

export const User = mongoose.model("User", user);
export const Invite = mongoose.model("Invite", invite);
export const Conversation = mongoose.model("Conversation", conversation);
export const Message = mongoose.model("Message", message);
