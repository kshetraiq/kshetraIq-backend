const express = require("express");
const { requireAuth, requireRole, ROLES } = require("../middlewares/auth");
const {
  createDiseaseObservationController,
  getPlotObservationsController,
} = require("../controllers/diseaseController");

const router = express.Router();

// Create observation (SCOUT / officer)
router.post(
  "/",
  requireAuth,
  requireRole([
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.ADMIN,
  ]),
  createDiseaseObservationController
);

// Alternative: nested under plot
router.post(
  "/plot/:plotId",
  requireAuth,
  requireRole([
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.ADMIN,
  ]),
  createDiseaseObservationController
);

// Get observations for a plot
router.get(
  "/plot/:plotId",
  requireAuth,
  requireRole([
    ROLES.FARMER,
    ROLES.LEAD_FARMER,
    ROLES.SCOUT,
    ROLES.MANDAL_OFFICER,
    ROLES.DISTRICT_COORDINATOR,
    ROLES.ADMIN,
  ]),
  getPlotObservationsController
);

module.exports = router;