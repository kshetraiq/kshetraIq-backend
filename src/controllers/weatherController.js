// src/controllers/weatherController.js
const {
  getWeatherCoverageSummary,
  getWeatherForPlot,
} = require("../services/weatherService");
const { ingestWeatherForPlotFromOpenMeteo } = require("../services/weatherIngestSerivice");

async function getWeatherCoverageSummaryController(req, res) {
  try {
    const { district, mandal, daysWindow } = req.query;
    const window = daysWindow ? parseInt(daysWindow, 10) : 7;

    const data = await getWeatherCoverageSummary({
      district,
      mandal,
      daysWindow: window,
    });

    res.json({ data });
  } catch (err) {
    console.error("Error in getWeatherCoverageSummaryController:", err);
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to fetch weather coverage summary",
    });
  }
}

async function getPlotWeatherController(req, res) {
  try {
    const { plotId } = req.params;
    const { fromDate, toDate } = req.query;
    const data = await getWeatherForPlot(plotId, { fromDate, toDate });
    res.json({ data });
  } catch (err) {
    console.error("Error in getPlotWeatherController:", err);
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to fetch weather for plot",
    });
  }
}

async function ingestWeatherForPlotController(req, res) {
  try {
    const { plotId } = req.params;
    const { days } = req.query;
    const daysToIngest = days ? parseInt(days, 10) : 7;

    const result = await ingestWeatherForPlotFromOpenMeteo(plotId, daysToIngest);

    res.json({
      message: `Ingested forecast for plot ${plotId}`,
      result,
    });
  } catch (err) {
    console.error("Error in ingestWeatherForPlotController:", err);
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to ingest weather for plot",
    });
  }
}

module.exports = {
  getWeatherCoverageSummaryController,
  getPlotWeatherController,
  ingestWeatherForPlotController,
};