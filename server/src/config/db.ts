import mongoose from "mongoose";

export let isMongoDBConnected = false;

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log("[Database] MONGODB_URI not specified. Using high-performance Local Storage.");
    return false;
  }

  try {
    console.log("[Database] Connecting to MongoDB (timeout: 3.5s)...");
    await mongoose.connect(uri, {
      family: 4,
      serverSelectionTimeoutMS: 3500,
      tls: true,
      tlsAllowInvalidCertificates: true,
    });

    isMongoDBConnected = true;
    console.log("✅ MongoDB connected successfully");
    return true;
  } catch (error: unknown) {
    isMongoDBConnected = false;
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ MongoDB connection unavailable (${msg}).`);
    console.log("🚀 Running seamlessly on resilient Local Persistent Database (data/chat_db.json).");
    return false;
  }
}