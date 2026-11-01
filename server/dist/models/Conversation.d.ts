import { Document, Model, Types } from "mongoose";
export interface IConversation extends Document {
    participants: Types.ObjectId[];
    participantKey: string;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Conversation: Model<IConversation>;
//# sourceMappingURL=Conversation.d.ts.map