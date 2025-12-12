const path = require("path");
const dotenv = require("dotenv");

// Load from project root (../../.env relative to src/config/env.js)
dotenv.config({ path: path.join(__dirname, "../../.env") });

const ENV = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "change_me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
};

module.exports = { ENV };