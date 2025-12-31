const express = require("express");
const router = express.Router();
const cronController = require("../controllers/cronController");

router.get("/weather-forecast", cronController.triggerWeatherUpdate);
router.get("/daily-archive", cronController.triggerDailyArchive);
router.get("/recompute", cronController.triggerRiskRecompute);
router.get("/history", cronController.getJobHistory);

module.exports = router;
