const express = require("express");
const { requireAuth, requireRole, ROLES } = require("../middlewares/auth");
const {
  createPlotController,
  listMyPlotsController,
  getPlotController,
} = require("../controllers/plotController");

const router = express.Router();

// Create plot
// - FARMER/LEAD_FARMER: creates own plot; farmer field ignored
// - SCOUT/MANDAL_OFFICER/ADMIN: can create plot for any farmerId (in body)
router.post(
  "/",
  requireAuth,
  requireRole([
    ROLES.FARMER,
    ROLES.LEAD_FARMER,
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.ADMIN,
  ]),
  createPlotController
);

// List plots visible to this user
router.get(
  "/",
  requireAuth,
  requireRole([
    ROLES.FARMER,
    ROLES.LEAD_FARMER,
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.ADMIN,
  ]),
  listMyPlotsController
);

// Get single plot by id
router.get(
  "/:id",
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
  getPlotController
);

module.exports = router;