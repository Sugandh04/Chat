import { Document, Model, Types } from "mongoose";
export interface IMessage extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    text: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Message: Model<IMessage>;
//# sourceMappingURL=Message.d.ts.map