// src/services/weatherDashboardService.js
const { Plot } = require("../models/plot");
const { WeatherDaily } = require("../models/weatherDaily");

async function getWeatherCoverageSummary({ district, mandal, daysWindow = 7 }) {
  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysWindow,
    23, 59, 59, 999
  );

  const matchPlots = {};
  if (district) matchPlots.district = district;
  if (mandal) matchPlots.mandal = mandal;

  const plots = await Plot.find(matchPlots).lean();
  const plotIds = plots.map((p) => p._id);

  if (plotIds.length === 0) return [];

  const weatherDocs = await WeatherDaily.aggregate([
    {
      $match: {
        plot: { $in: plotIds },
        isForecast: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$plot",
        daysAvailable: { $addToSet: "$date" }, // unique days
        minDate: { $min: "$date" },
        maxDate: { $max: "$date" },
        count: { $sum: 1 },
      },
    },
  ]);

  const byPlotId = new Map();
  for (const w of weatherDocs) {
    byPlotId.set(w._id.toString(), {
      daysAvailable: w.daysAvailable.length,
      minDate: w.minDate,
      maxDate: w.maxDate,
      docCount: w.count,
    });
  }

  return plots.map((p) => {
    const meta = byPlotId.get(p._id.toString());
    const daysAvailable = meta?.daysAvailable || 0;
    const completeness = daysWindow
      ? Math.round((daysAvailable / daysWindow) * 100)
      : 0;

    return {
      plotId: p._id.toString(),
      plotName: p.name,
      farmerId: p.farmer?.toString(),
      village: p.village,
      mandal: p.mandal,
      district: p.district,
      crop: p.crop,
      variety: p.variety,
      daysWindow,
      daysAvailable,
      completeness, // 0–100 %
      minDate: meta?.minDate || null,
      maxDate: meta?.maxDate || null,
    };
  });
}

async function getWeatherForPlot(plotId, { fromDate, toDate }) {
  // default: from today - 7 days to today + 7 days
  const now = new Date();

  const defaultFrom = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 7,
    0, 0, 0, 0
  );
  const defaultTo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7,
    23, 59, 59, 999
  );

  const from = fromDate ? new Date(fromDate) : defaultFrom;
  const to = toDate ? new Date(toDate) : defaultTo;

  const docs = await WeatherDaily.find({
    plot: plotId,
    date: { $gte: from, $lte: to },
  })
    .sort({ date: 1 })
    .lean();

  return docs;
}

module.exports = {
  getWeatherCoverageSummary,
  getWeatherForPlot,
};