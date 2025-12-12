const {
  createDiseaseObservation,
  getObservationsForPlot,
} = require("../services/diseaseService");

async function createDiseaseObservationController(req, res) {
  try {
    const body = {
      ...req.body,
      plot: req.body.plot || req.params.plotId,
    };
    const obs = await createDiseaseObservation(body, req.user);
    res.status(201).json(obs);
  } catch (err) {
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to create disease observation",
    });
  }
}

async function getPlotObservationsController(req, res) {
  try {
    const plotId = req.params.plotId;
    const observations = await getObservationsForPlot(plotId, req.user);
    res.json(observations);
  } catch (err) {
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to fetch observations",
    });
  }
}

module.exports = {
  createDiseaseObservationController,
  getPlotObservationsController,
};