// src/routes/riskRoutes.js

const express = require("express");
const { requireAuth, requireRole, ROLES } = require("../middlewares/auth");

const {
  // generic recompute controllers (mode-aware)
  recomputeAllRisksController,
  recomputePlotRisksController,

  // read controllers
  getPlotRisksController,
  getLatestRisksByPlotController,
} = require("../controllers/riskController");

const router = express.Router();

/**
 * POST /api/risk/recompute
 *
 * Recompute risks for ALL plots.
 * Query params:
 *   - mode?       = "PAST" | "FORECAST" | "PROACTIVE" (default: "FORECAST")
 *   - daysWindow? = integer (default: 7)
 *
 * Example:
 *   POST /api/risk/recompute?mode=FORECAST&daysWindow=7
 */
router.post(
  "/recompute",
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.DISTRICT_COORDINATOR]),
  recomputeAllRisksController
);

/**
 * POST /api/risk/plot/:plotId/recompute
 *
 * Recompute risks for a single plot.
 * Query params:
 *   - mode?       = "PAST" | "FORECAST" | "PROACTIVE" (default: "FORECAST")
 *   - daysWindow? = integer (default: 7)
 *
 * Example:
 *   POST /api/risk/plot/64f.../recompute?mode=PROACTIVE&daysWindow=7
 */
router.post(
  "/plot/:plotId/recompute",
  requireAuth,
  requireRole([
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.SCIENTIST,
    ROLES.WEATHER_SCIENTIST,
    ROLES.ADMIN,
  ]),
  recomputePlotRisksController
);

/**
 * GET /api/risk/plot/:plotId
 *
 * Get stored risk history for a plot.
 * All roles from farmer upwards can view their plot’s history.
 */
router.get(
  "/plot/:plotId",
  requireAuth,
  requireRole([
    ROLES.FARMER,
    ROLES.LEAD_FARMER,
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.SCIENTIST,
    ROLES.WEATHER_SCIENTIST,
    ROLES.ADMIN,
  ]),
  getPlotRisksController
);

/**
 * GET /api/risk/latest-by-plot?district=&mandal=
 *
 * Get latest risk per (plot, disease) with optional filters.
 * Intended for dashboards (scientist / admin / district coordinator).
 */
router.get(
  "/latest-by-plot",
  requireAuth,
  requireRole([ROLES.SCIENTIST, ROLES.ADMIN, ROLES.DISTRICT_COORDINATOR]),
  getLatestRisksByPlotController
);

module.exports = router;