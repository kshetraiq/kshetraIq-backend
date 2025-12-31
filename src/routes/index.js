const express = require("express");
const authRoutes = require("./authRoutes");
const plotRoutes = require("./plotRoutes");
const diseaseRoutes = require("./diseaseRoutes");
const riskRoutes = require("./riskRoutes");
const weatherRoutes = require("./weatherRoutes");
const cronRoutes = require("./cronRoutes");

// later: const plotRoutes = require("./plotRoutes"); etc.

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/plots", plotRoutes);
router.use("/diseases", diseaseRoutes);
router.use("/risks", riskRoutes);
router.use("/weather", weatherRoutes);
router.use("/cron", cronRoutes);
// router.use("/plots", plotRoutes);
// router.use("/diseases", diseaseRoutes);
// router.use("/risks", riskRoutes);
// router.use("/advisories", advisoryRoutes);

module.exports = router;