const { DiseaseObservation, DISEASE_TYPES } = require("../models/diseaseObservation");
const { Plot } = require("../models/plot");
const { ROLES } = require("../utils/roles");

async function createDiseaseObservation(input, user) {
  // Only SCOUT / MANDAL_OFFICER / DISTRICT_COORDINATOR / ADMIN
  if (
    ![ROLES.SCOUT, ROLES.MANDAL_OFFICER, ROLES.DISTRICT_COORDINATOR, ROLES.ADMIN].includes(
      user.role
    )
  ) {
    const err = new Error("Only field staff or officers can record disease observations");
    err.statusCode = 403;
    throw err;
  }

  const plot = await Plot.findById(input.plot);
  if (!plot) {
    const err = new Error("Plot not found");
    err.statusCode = 404;
    throw err;
  }

  // Basic access control: SCOUT must be in same mandal/district
  if (user.role === ROLES.SCOUT || user.role === ROLES.MANDAL_OFFICER) {
    if (user.mandal && plot.mandal !== user.mandal) {
      const err = new Error("You cannot record data for a different mandal");
      err.statusCode = 403;
      throw err;
    }
  }

  // Validate diseases array
  const diseases = (input.diseases || []).map((d) => {
    if (!DISEASE_TYPES.includes(d.type)) {
      throw new Error(`Invalid disease type: ${d.type}`);
    }
    return {
      type: d.type,
      present: !!d.present,
      severityScore: d.severityScore,
      severityPercent: d.severityPercent,
    };
  });

  const obs = new DiseaseObservation({
    plot: input.plot,
    observer: user._id,
    observationDate: input.observationDate || new Date(),
    cropStage: input.cropStage,
    variety: input.variety || plot.variety,
    season: input.season || plot.season,
    nitrogenLevel: input.nitrogenLevel,
    lastFungicideDate: input.lastFungicideDate,
    diseases,
    photos: input.photos || [],
  });

  await obs.save();
  return obs;
}

async function getObservationsForPlot(plotId, user) {
  const plot = await Plot.findById(plotId);
  if (!plot) {
    const err = new Error("Plot not found");
    err.statusCode = 404;
    throw err;
  }

  // Farmers can see their own plot's observations
  // Scouts/Officers limited by mandal
  if (user.role === ROLES.FARMER || user.role === ROLES.LEAD_FARMER) {
    if (String(plot.farmer) !== String(user._id)) {
      const err = new Error("Forbidden: not your plot");
      err.statusCode = 403;
      throw err;
    }
  }

  if (user.role === ROLES.SCOUT || user.role === ROLES.MANDAL_OFFICER) {
    if (user.mandal && plot.mandal !== user.mandal) {
      const err = new Error("Forbidden: different mandal");
      err.statusCode = 403;
      throw err;
    }
  }

  const observations = await DiseaseObservation.find({ plot: plotId })
    .sort({ observationDate: -1 })
    .populate("observer", "name phone role");

  return observations;
}

module.exports = {
  createDiseaseObservation,
  getObservationsForPlot,
};