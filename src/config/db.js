const mongoose = require("mongoose");
const { ENV } = require("./env");

async function connectDB() {
  try {
    if (!ENV.MONGODB_URI) throw new Error("MONGODB_URI not configured");
    await mongoose.connect(ENV.MONGODB_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

module.exports = { connectDB };