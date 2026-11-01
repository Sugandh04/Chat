import mongoose from "mongoose";
export let isMongoDBConnected = false;
export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("[Database] MONGODB_URI is missing from environment variables.");
    }
    mongoose.connection.on("connected", () => {
        isMongoDBConnected = true;
        console.log("✅ MongoDB connected");
    });
    mongoose.connection.on("disconnected", () => {
        isMongoDBConnected = false;
        console.warn("⚠️ MongoDB disconnected");
    });
    mongoose.connection.on("error", (error) => {
        console.error("[Database] Connection error:", error);
    });
    try {
        console.log("[Database] Connecting to MongoDB...");
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4,
        });
        isMongoDBConnected = true;
        console.log("✅ MongoDB connection established successfully");
    }
    catch (error) {
        isMongoDBConnected = false;
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Database] Connection failed:", message);
        throw error;
    }
}
//# sourceMappingURL=db.js.map