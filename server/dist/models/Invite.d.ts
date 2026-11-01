import { Document, Model } from "mongoose";
export interface IInvite extends Document {
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Invite: Model<IInvite>;
//# sourceMappingURL=Invite.d.ts.map