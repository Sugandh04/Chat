import { Schema, model, Document, Model, Types } from "mongoose";
const messageSchema = new Schema({
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
}, { timestamps: true });
messageSchema.index({
    conversationId: 1,
    createdAt: -1,
    _id: -1,
});
export const Message = model("Message", messageSchema);
//# sourceMappingURL=Message.js.map