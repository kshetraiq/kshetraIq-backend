// src/cron/ingestAndRecompute.js
require("dotenv").config();
const mongoose = require("mongoose");
const { ingestWeatherForPlotFromOpenMeteo } = require("../../src/services/weatherIngestSerivice");
const { evaluateRiskForPlotRealWeather } = require("../../src/services/riskService");



async function main() {
  const plotId = "6922b0c29b0152bda6c98618"; // Nageswaramma Field 1



  // 1) Ingest last 7 days of weather via Open-Meteo
  const ingestResult = await ingestWeatherForPlotFromOpenMeteo(plotId, 7);
  console.log("✅ Ingest result:", ingestResult);

  // 2) Recompute risks using real weather
  const riskResult = await evaluateRiskForPlotRealWeather(plotId, 7);
  console.log("✅ Recomputed risks for plot", plotId, ":");
  console.dir(
    {
      plot: {
        name: riskResult.plot?.name,
        mandal: riskResult.plot?.mandal,
        district: riskResult.plot?.district,
      },
      risks: riskResult.risks.map((r) => ({
        disease: r.disease,
        date: r.date,
        severity: r.severity,
        score: r.score,
      })),
    },
    { depth: null }
  );

  await mongoose.disconnect();
  console.log("🔚 Done");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});