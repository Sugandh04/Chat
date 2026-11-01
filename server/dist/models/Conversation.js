import { Schema, model, Document, Model, Types } from "mongoose";
const conversationSchema = new Schema({
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
            validator: (ids) => Array.isArray(ids) &&
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
}, { timestamps: true });
conversationSchema.index({
    participants: 1,
    lastMessageAt: -1,
});
export const Conversation = model("Conversation", conversationSchema);
//# sourceMappingURL=Conversation.js.map