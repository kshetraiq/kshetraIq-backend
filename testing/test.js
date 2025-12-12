// src/cron/testWeather.js
const fs = require("fs");
const path = require("path");
const { fetchWeatherForLatLon } = require("./fetchweather");

async function test() {
  const lat = 16.086; // Chilakaluripet example
  const lon = 80.169; // your exact coords

  const data = await fetchWeatherForLatLon(lat, lon);

  // Create a simple filename with today's date
  const today = new Date().toISOString().slice(0, 10); // "2025-11-23"
  const outputDir = path.join(__dirname, "output");
  const outputFile = path.join(outputDir, `weather-${today}.json`);

  // Ensure the output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write JSON file (pretty printed)
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");

  console.log("✅ Weather data saved to:", outputFile);
}

test().catch((err) => {
  console.error("❌ Error in testWeather:", err);
});