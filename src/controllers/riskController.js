// src/controllers/riskController.js

const {
  evaluateRiskForPlot,
  evaluateRiskForAllPlots,
  evaluateForecastRiskForPlot,      // wrapper
  evaluateRiskForAllPlotsRealWeather, // wrapper
  getRisksForPlot,
  getLatestRisksByPlot,
} = require("../services/riskService");

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseDaysWindow(req) {
  if (!req.query.daysWindow) return 7;
  const n = parseInt(req.query.daysWindow, 10);
  return Number.isNaN(n) || n <= 0 ? 7 : n;
}

function parseMode(req) {
  const allowed = ["PAST", "FORECAST", "PROACTIVE"];
  const modeRaw = (req.query.mode || "FORECAST").toUpperCase();
  return allowed.includes(modeRaw) ? modeRaw : "FORECAST";
}

// -----------------------------------------------------------------------------
// Controllers
// -----------------------------------------------------------------------------

// Generic: recompute risks for ALL plots in given mode
async function recomputeAllRisksController(req, res) {
  try {
    const daysWindow = parseDaysWindow(req);
    const mode = parseMode(req);

    const results = await evaluateRiskForAllPlots({
      daysWindow,
      mode,
    });

    res.json({
      success: true,
      message: `Risk evaluation (${mode.toLowerCase()}) completed for all plots`,
      data: {
        mode,
        daysWindow,
        plotsProcessed: results.length,
        results,
      },
    });
  } catch (err) {
    console.error("Error in recomputeAllRisksController:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to recompute risks for all plots",
    });
  }
}

// Generic: recompute risk for ONE plot in given mode
async function recomputePlotRisksController(req, res) {
  try {
    const { plotId } = req.params;
    const daysWindow = parseDaysWindow(req);
    const mode = parseMode(req);

    const result = await evaluateRiskForPlot(plotId, {
      daysWindow,
      mode,
    });

    console.log(`Recomputed ${mode} risks for plot ${plotId}`);

    res.json({
      success: true,
      message: `Risk evaluation (${mode.toLowerCase()}) completed for plot`,
      data: {
        plotId,
        plotName: result.plot?.name,
        mode: result.mode,
        daysWindow,
        risks: result.risks,
        info: result.message, // optional message if present
      },
    });
  } catch (err) {
    console.error("Error in recomputePlotRisksController:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to recompute plot risks",
    });
  }
}

// If you want to keep the old "real weather" endpoints for now:
async function recomputeAllRisksRealController(req, res) {
  try {
    const daysWindow = parseDaysWindow(req);
    const results = await evaluateRiskForAllPlotsRealWeather(daysWindow);

    res.json({
      success: true,
      message: "Risk evaluation (forecast window) completed for all plots",
      data: {
        mode: "FORECAST",
        daysWindow,
        plotsProcessed: results.length,
        results,
      },
    });
  } catch (err) {
    console.error("Error in recomputeAllRisksRealController:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to recompute risks for all plots",
    });
  }
}

async function recomputePlotRisksRealController(req, res) {
  try {
    const { plotId } = req.params;
    const daysWindow = parseDaysWindow(req);

    const result = await evaluateForecastRiskForPlot(plotId, daysWindow);

    res.json({
      success: true,
      message: "Risk evaluation (forecast window) completed for plot",
      data: {
        plotId,
        plotName: result.plot?.name,
        mode: "FORECAST",
        daysWindow,
        risks: result.risks,
        info: result.message,
      },
    });
  } catch (err) {
    console.error("Error in recomputePlotRisksRealController:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to recompute plot risks",
    });
  }
}

// Get full risk history for a plot
async function getPlotRisksController(req, res) {
  try {
    const { plotId } = req.params;
    const risks = await getRisksForPlot(plotId);
    res.json({
      success: true,
      data: risks,
    });
  } catch (err) {
    console.error("Error in getPlotRisksController:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch risks",
    });
  }
}

// Get latest risk per (plot, disease), with optional district/mandal filters
async function getLatestRisksByPlotController(req, res) {
  try {
    const { district, mandal } = req.query; // optional filters
    const data = await getLatestRisksByPlot({ district, mandal });
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Error in getLatestRisksByPlotController:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch latest risks by plot",
    });
  }
}

module.exports = {
  // New generic controllers
  recomputeAllRisksController,
  recomputePlotRisksController,

  // Backward-compatible controllers (optional)
  recomputeAllRisksRealController,
  recomputePlotRisksRealController,

  // Read controllers
  getPlotRisksController,
  getLatestRisksByPlotController,
};