import mongoose from "mongoose";
export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is missing from .env");
    }
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
}
//# sourceMappingURL=db.js.map