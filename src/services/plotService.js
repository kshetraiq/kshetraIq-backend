const { Plot } = require("../models/plot");
const { ROLES } = require("../utils/roles");

async function createPlot(input, user) {
  let farmerId = input.farmer;

  // If the logged-in user is a FARMER, force farmer = self
  if (user.role === ROLES.FARMER || user.role === ROLES.LEAD_FARMER) {
    farmerId = user._id;
  }

  if (!farmerId) {
    const err = new Error("farmer field is required");
    err.statusCode = 400;
    throw err;
  }

  const plot = new Plot({
    farmer: farmerId,
    name: input.name,
    district: input.district,
    mandal: input.mandal,
    village: input.village,
    location: {
      lat: input.location.lat,
      lng: input.location.lng,
    },
    areaAcre: input.areaAcre,
    crop: input.crop || "RICE",
    variety: input.variety,
    sowingDate: input.sowingDate,
    irrigationType: input.irrigationType,
    season: input.season,
  });

  await plot.save();
  return plot;
}

async function getMyPlots(user) {
  const query = {};

  if (user.role === ROLES.FARMER || user.role === ROLES.LEAD_FARMER) {
    query.farmer = user._id;
  } else if (user.role === ROLES.SCOUT || user.role === ROLES.MANDAL_OFFICER) {
    if (user.mandal) query.mandal = user.mandal;
    if (user.district) query.district = user.district;
  }

  // ADMIN / DISTRICT_COORDINATOR see everything for now
  const plots = await Plot.find(query).populate("farmer", "name phone");
  return plots;
}

async function getPlotById(id, user) {
  const plot = await Plot.findById(id).populate("farmer", "name phone");
  if (!plot) {
    const err = new Error("Plot not found");
    err.statusCode = 404;
    throw err;
  }

  // Basic access control: farmer, or same mandal/district officer, or admin
  if (
    user.role === ROLES.FARMER ||
    user.role === ROLES.LEAD_FARMER
  ) {
    if (String(plot.farmer._id) !== String(user._id)) {
      const err = new Error("Forbidden: you do not own this plot");
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

  return plot;
}

module.exports = {
  createPlot,
  getMyPlots,
  getPlotById,
};