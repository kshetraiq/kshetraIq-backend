// src/routes/weatherRoutes.js
const express = require("express");
const { requireAuth, requireRole, ROLES } = require("../middlewares/auth");
const {
  getWeatherCoverageSummaryController,
  getPlotWeatherController,
  ingestWeatherForPlotController,
} = require("../controllers/weatherController");

const router = express.Router();

// Summary: coverage per plot (for dashboard)
router.get(
  "/coverage",
  requireAuth,
  requireRole([ROLES.WEATHER_SCIENTIST, ROLES.ADMIN]),
  getWeatherCoverageSummaryController
);

// Raw WeatherDaily for a single plot (table view)
router.get(
  "/plot/:plotId",
  requireAuth,
  requireRole([
    ROLES.FARMER,
    ROLES.WEATHER_SCIENTIST,
    ROLES.SCIENTIST,
    ROLES.ADMIN,
  ]),
  getPlotWeatherController
);

// Trigger ingest from Open-Meteo for a plot
router.post(
  "/plot/:plotId/ingest",
  requireAuth,
  requireRole([ROLES.WEATHER_SCIENTIST, ROLES.ADMIN]),
  ingestWeatherForPlotController
);

module.exports = router;