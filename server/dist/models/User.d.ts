import { Document, Model } from "mongoose";
export interface IUser extends Document {
    displayName: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: Model<IUser>;
//# sourceMappingURL=User.d.ts.map