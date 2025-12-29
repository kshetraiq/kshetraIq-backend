const app = require("./app");
const { connectDB } = require("./config/db");
const { ENV } = require("./config/env");
const { initCronJobs } = require("./services/cronService");

async function start() {
  await connectDB();

  // Start Cron Jobs
  initCronJobs();

  app.listen(ENV.PORT, () => {
    console.log(`🚀 Server running on port ${ENV.PORT}`);
  });
}

start(); 