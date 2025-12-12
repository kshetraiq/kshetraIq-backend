const app = require("./app");
const { connectDB } = require("./config/db");
const { ENV } = require("./config/env");

async function start() {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`🚀 Server running on port ${ENV.PORT}`);
  });
}

start(); 