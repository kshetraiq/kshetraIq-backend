const { createPlot, getMyPlots, getPlotById } = require("../services/plotService");

async function createPlotController(req, res) {
  try {
    const plot = await createPlot(req.body, req.user);
    res.status(201).json(plot);
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || "Failed to create plot" });
  }
}

async function listMyPlotsController(req, res) {
  try {
    const plots = await getMyPlots(req.user);
    res.json(plots);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch plots" });
  }
}

async function getPlotController(req, res) {
  try {
    const plot = await getPlotById(req.params.id, req.user);
    res.json(plot);
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || "Failed to fetch plot" });
  }
}

module.exports = {
  createPlotController,
  listMyPlotsController,
  getPlotController,
};