import { Schema, model, Document, Model } from "mongoose";
const userSchema = new Schema({
    displayName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254,
    },
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
}, { timestamps: true });
export const User = model("User", userSchema);
//# sourceMappingURL=User.js.map