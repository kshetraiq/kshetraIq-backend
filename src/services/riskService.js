// src/services/riskService.js

const { Plot } = require("../models/plot");
const { WeatherDaily } = require("../models/weatherDaily");
const { RiskEvent } = require("../models/riskEvent");
const {
  DiseaseObservation,
  DISEASE_TYPES,
} = require("../models/diseaseObservation");
const {
  evaluateRiceDiseaseRiskV2,
} = require("./riskEngine/riceDiseases");
const {
  ingestWeatherForPlotFromOpenMeteo,
} = require("./weatherIngestSerivice");

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function inferCropStage(sowingDate, refDate = new Date()) {
  if (!sowingDate) return "unknown";
  const s = new Date(sowingDate);
  const diffDays = Math.floor((refDate - s) / (1000 * 60 * 60 * 24));

  // very rough: tune later with scientists
  if (diffDays <= 20) return "nursery";
  if (diffDays <= 45) return "tillering";
  if (diffDays <= 65) return "panicle-init";
  if (diffDays <= 80) return "booting";
  if (diffDays <= 100) return "heading";
  return "maturity";
}

function estimateLeafWetnessHours(rhMean, rainfallMm) {
  // simple heuristic: tune later
  if (rainfallMm > 0) return 8;
  if (rhMean >= 90) return 6;
  if (rhMean >= 85) return 3;
  return 0;
}

/**
 * Normalize JS Date to midnight (for RiskEvent.date key)
 */
function normalizeDateToMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Classify a 0–100 score into level.
 * Keep thresholds in sync with riceDiseases.classifyRisk.
 */
function classifyScore(score) {
  let level = "GREEN";
  if (score >= 75) level = "RED";
  else if (score >= 50) level = "ORANGE";
  else if (score >= 30) level = "YELLOW";
  return level;
}

/**
 * Build a weather window for a plot.
 *
 * windowType:
 *   - "PAST":   last `daysWindow` days including today (obs)
 *   - "FORECAST": from tomorrow (D+1) to D+daysWindow (forecast)
 */
async function buildWeatherWindowForPlot({
  plot,
  daysWindow = 7,
  windowType = "FORECAST", // "PAST" | "FORECAST"
}) {
  const now = new Date();

  let startDate, endDate;
  if (windowType === "PAST") {
    // PAST: last N days including today
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (daysWindow - 1));
  } else {
    // FORECAST: from tomorrow to D+daysWindow
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 0
    );
    endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysWindow,
      23, 59, 59, 999
    );
  }

  console.log(
    `📈 BUILD WINDOW [${windowType}] for plot ${plot._id}:`,
    "startDate =", startDate,
    "endDate =", endDate
  );

  // NOTE:
  // - If your WeatherDaily has isForecast flag, you can filter by it.
  //   For now we rely only on date ranges so it works regardless.

  const query = {
    plot: plot._id,
    date: { $gte: startDate, $lte: endDate },
  };

  // Uncomment if you have a strict isForecast boolean in schema
  // if (windowType === "FORECAST") query.isForecast = true;
  // if (windowType === "PAST") query.isForecast = { $ne: true };

  const weatherDocs = await WeatherDaily.find(query)
    .sort({ date: 1 })
    .lean();

  console.log(
    `📈 WEATHER DOCS [${windowType}] for plot ${plot._id}:`,
    weatherDocs.length
  );

  if (!weatherDocs || weatherDocs.length === 0) {
    return null;
  }

  // latest disease observation (for nitrogen level, water status, etc.)
  const latestObs = await DiseaseObservation.findOne({ plot: plot._id })
    .sort({ observationDate: -1 })
    .lean();

  // Use mid-window date as ref for crop stage (more consistent with forecast)
  const firstDate = weatherDocs[0].date;
  const lastDate = weatherDocs[weatherDocs.length - 1].date;
  const midTime = (firstDate.getTime() + lastDate.getTime()) / 2;
  const midDate = new Date(midTime);

  const cropStage =
    latestObs?.cropStage || inferCropStage(plot.sowingDate, midDate);

  const management = {
    nitrogenLevel: latestObs?.nitrogenLevel || null, // "HIGH" | "MEDIUM" | "LOW"
    waterStatus: latestObs?.waterStatus || null,     // "FLOODED" | "NORMAL" | "STRESSED"
  };

  const dates = [];
  const tMin = [];
  const tMax = [];
  const tMean = [];
  const rhMorning = [];
  const rhEvening = [];
  const rainfall = [];
  const windSpeed = [];
  const solarRadiation = [];
  const sunshineHours = [];
  const leafWetnessHours = [];

  for (const d of weatherDocs) {
    dates.push(d.date.toISOString().slice(0, 10));

    // Temperatures
    const tMinVal = d.tMin ?? d.tmin ?? d.t_min;
    const tMaxVal = d.tMax ?? d.tmax ?? d.t_max;

    let tMeanVal;
    if (typeof d.tMean === "number") {
      tMeanVal = d.tMean;
    } else if (typeof tMinVal === "number" && typeof tMaxVal === "number") {
      tMeanVal = (tMinVal + tMaxVal) / 2;
    } else {
      tMeanVal = 0;
    }

    tMin.push(typeof tMinVal === "number" ? tMinVal : 0);
    tMax.push(typeof tMaxVal === "number" ? tMaxVal : 0);
    tMean.push(tMeanVal);

    // Humidity
    const rhMean = d.rhMean ?? d.rh_mean;
    const rhM = d.rhMorning ?? rhMean ?? 0;
    const rhE = d.rhEvening ?? rhMean ?? 0;
    rhMorning.push(rhM);
    rhEvening.push(rhE);

    // Rainfall
    const rainMm = d.rainfallMm ?? d.precipitation ?? 0;
    rainfall.push(rainMm);

    // Wind, radiation, sunshine
    windSpeed.push(d.windSpeed ?? d.windspeed ?? 0);
    solarRadiation.push(d.solarRadiation ?? d.shortwaveRadiation ?? 0);
    sunshineHours.push(d.sunshineHours ?? 0);

    // Leaf wetness (measured or estimated)
    const lwh =
      d.leafWetnessHours ??
      estimateLeafWetnessHours(rhMean ?? 0, rainMm);
    leafWetnessHours.push(lwh);
  }

  return {
    dates,
    tMin,
    tMax,
    tMean,
    rhMorning,
    rhEvening,
    rainfall,
    windSpeed,
    solarRadiation,
    sunshineHours,
    leafWetnessHours,
    cropStage,
    management,
    meta: {
      windowType,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      mandal: plot.mandal,
      district: plot.district,
      lat: plot.location?.lat,
      lon: plot.location?.lng,
    },
  };
}

// -----------------------------------------------------------------------------
// Core risk evaluation
// -----------------------------------------------------------------------------

/**
 * Generic evaluator for a single plot.
 *
 * mode:
 *   - "PAST"      -> last N days (obs)
 *   - "FORECAST"  -> next N days (forecast)
 *   - "PROACTIVE" -> weighted combo of PAST + FORECAST
 */
async function evaluateRiskForPlot(
  plotId,
  {
    daysWindow = 7,
    mode = "FORECAST", // "PAST" | "FORECAST" | "PROACTIVE"
    autoIngestIfMissing = true,
    pastWeight = 0.4,
    futureWeight = 0.6,
  } = {}
) {
  const plot = await Plot.findById(plotId);
  if (!plot) {
    const err = new Error("Plot not found");
    err.statusCode = 404;
    throw err;
  }

  const today = normalizeDateToMidnight(new Date());
  const riskEvents = [];

  // ---------------------------------------------------------------------------
  // PROACTIVE: combine past + future
  // ---------------------------------------------------------------------------
  if (mode === "PROACTIVE") {
    let pastWindow = await buildWeatherWindowForPlot({
      plot,
      daysWindow,
      windowType: "PAST",
    });
    let futureWindow = await buildWeatherWindowForPlot({
      plot,
      daysWindow,
      windowType: "FORECAST",
    });

    const needsIngest =
      !pastWindow ||
      !Array.isArray(pastWindow.dates) ||
      pastWindow.dates.length < daysWindow ||
      !futureWindow ||
      !Array.isArray(futureWindow.dates) ||
      futureWindow.dates.length < daysWindow;

    if (needsIngest && autoIngestIfMissing) {
      console.log(
        `⚠️ Weather windows (PAST+FORECAST) for plot ${plot._id} are missing/incomplete. Ingesting from Open-Meteo...`
      );
      await ingestWeatherForPlotFromOpenMeteo(plot._id.toString(), daysWindow);
      // rebuild after ingest
      pastWindow = await buildWeatherWindowForPlot({
        plot,
        daysWindow,
        windowType: "PAST",
      });
      futureWindow = await buildWeatherWindowForPlot({
        plot,
        daysWindow,
        windowType: "FORECAST",
      });
    }

    if (
      (!pastWindow || !pastWindow.dates?.length) &&
      (!futureWindow || !futureWindow.dates?.length)
    ) {
      return {
        plot,
        mode,
        risks: [],
        message: "No weather data (history or forecast) for this plot",
      };
    }

    for (const disease of DISEASE_TYPES) {
      let rPast = null;
      let rFuture = null;
      let pastScore = 0,
        pastLevel = "GREEN";
      let futureScore = 0,
        futureLevel = "GREEN";

      if (pastWindow && pastWindow.dates?.length) {
        rPast = evaluateRiceDiseaseRiskV2(disease, pastWindow);
        pastScore = rPast.score;
        pastLevel = rPast.level;
      }
      if (futureWindow && futureWindow.dates?.length) {
        rFuture = evaluateRiceDiseaseRiskV2(disease, futureWindow);
        futureScore = rFuture.score;
        futureLevel = rFuture.level;
      }

      const combinedScore = Math.round(
        pastWeight * pastScore + futureWeight * futureScore
      );
      const combinedLevel = classifyScore(combinedScore);

      const explanation = `Past ${
        daysWindow
      } days: ${pastLevel} (${pastScore}); Next ${daysWindow} days: ${futureLevel} (${futureScore})`;

      const drivers = {
        pastScore,
        pastLevel,
        futureScore,
        futureLevel,
        pastDrivers: rPast?.drivers || null,
        futureDrivers: rFuture?.drivers || null,
      };

      const riskEvent = await RiskEvent.findOneAndUpdate(
        { plot: plot._id, disease, date: today, source: "WEATHER_V2_PROACTIVE" },
        {
          plot: plot._id,
          disease,
          date: today,
          severity: combinedLevel,
          score: combinedScore,
          horizonDays: daysWindow,
          explanation,
          drivers,
          source: "WEATHER_V2_PROACTIVE",
          createdBy: "RULE_ENGINE",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      riskEvents.push(riskEvent);
    }

    return { plot, mode, risks: riskEvents };
  }

  // ---------------------------------------------------------------------------
  // Single-window modes: "PAST" or "FORECAST"
  // ---------------------------------------------------------------------------
  const windowType = mode === "PAST" ? "PAST" : "FORECAST";

  let window = await buildWeatherWindowForPlot({
    plot,
    daysWindow,
    windowType,
  });

  const needsIngest =
    !window || !Array.isArray(window.dates) || window.dates.length < daysWindow;

  if (needsIngest && autoIngestIfMissing) {
    console.log(
      `⚠️ Weather window [${windowType}] for plot ${plot._id} is missing or incomplete (${window?.dates?.length || 0}/${daysWindow}). Ingesting from Open-Meteo...`
    );
    try {
      await ingestWeatherForPlotFromOpenMeteo(plot._id.toString(), daysWindow);
    } catch (err) {
      console.error(
        `❌ Failed to ingest weather for plot ${plot._id}:`,
        err.message
      );
      return {
        plot,
        mode,
        risks: [],
        message: `Failed to ingest weather data: ${err.message}`,
      };
    }

    window = await buildWeatherWindowForPlot({
      plot,
      daysWindow,
      windowType,
    });
  }

  if (!window || !Array.isArray(window.dates) || window.dates.length === 0) {
    return {
      plot,
      mode,
      risks: [],
      message: "No weather data available for this plot (even after ingest)",
    };
  }

  const source =
    mode === "PAST" ? "WEATHER_V2_PAST" : "WEATHER_V2_FORECAST";

  for (const disease of DISEASE_TYPES) {
    const { score, level, explanation, drivers } =
      evaluateRiceDiseaseRiskV2(disease, window);

    const riskEvent = await RiskEvent.findOneAndUpdate(
      { plot: plot._id, disease, date: today, source },
      {
        plot: plot._id,
        disease,
        date: today,
        severity: level,
        score,
        horizonDays: daysWindow,
        explanation,
        drivers,
        source,
        createdBy: "RULE_ENGINE",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    riskEvents.push(riskEvent);
  }

  return { plot, mode, risks: riskEvents };
}

/**
 * Evaluate risk for ALL plots (cron / admin) in a given mode.
 */
async function evaluateRiskForAllPlots({
  daysWindow = 7,
  mode = "FORECAST",
  autoIngestIfMissing = true,
  pastWeight = 0.4,
  futureWeight = 0.6,
} = {}) {
  const plots = await Plot.find({});
  const results = [];

  // NOTE: sequential to avoid hammering external API.
  // You can later add concurrency control if needed.
  for (const plot of plots) {
    try {
      const res = await evaluateRiskForPlot(plot._id, {
        daysWindow,
        mode,
        autoIngestIfMissing,
        pastWeight,
        futureWeight,
      });
      results.push({
        plotId: plot._id,
        plotName: plot.name,
        mandal: plot.mandal,
        district: plot.district,
        mode: res.mode,
        risks: res.risks,
      });
    } catch (err) {
      console.error(
        `Failed to evaluate risk for plot ${plot._id}:`,
        err.message
      );
      results.push({
        plotId: plot._id,
        plotName: plot.name,
        mandal: plot.mandal,
        district: plot.district,
        mode,
        error: err.message,
      });
    }
  }

  return results;
}

// -----------------------------------------------------------------------------
// Read APIs
// -----------------------------------------------------------------------------

async function getRisksForPlot(plotId) {
  const risks = await RiskEvent.find({ plot: plotId })
    .sort({ date: -1, disease: 1 })
    .lean();
  return risks;
}

async function getLatestRisksByPlot(filters = {}) {
  const matchPlots = {};
  if (filters.district) matchPlots.district = filters.district;
  if (filters.mandal) matchPlots.mandal = filters.mandal;

  // 1) Get plots in filter scope
  const plots = await Plot.find(matchPlots).lean();
  const plotIds = plots.map((p) => p._id);

  if (plotIds.length === 0) return [];

  // 2) Aggregate latest risk per (plot, disease)
  const latestRisks = await RiskEvent.aggregate([
    { $match: { plot: { $in: plotIds } } },
    { $sort: { date: -1 } }, // newest first
    {
      $group: {
        _id: { plot: "$plot", disease: "$disease" },
        doc: { $first: "$$ROOT" },
      },
    },
  ]);

  // 3) Reshape into array of plots with nested risks
  const plotMap = new Map();
  for (const p of plots) {
    plotMap.set(p._id.toString(), {
      plotId: p._id.toString(),
      plotName: p.name,
      farmerId: p.farmer?.toString(),
      village: p.village,
      mandal: p.mandal,
      district: p.district,
      crop: p.crop,
      variety: p.variety,
      latestRisks: {}, // disease -> riskEvent
    });
  }

  for (const r of latestRisks) {
    const plotIdStr = r._id.plot.toString();
    const entry = plotMap.get(plotIdStr);
    if (!entry) continue;
    entry.latestRisks[r._id.disease] = r.doc;
  }

  return Array.from(plotMap.values());
}

// -----------------------------------------------------------------------------
// Backward-compatible wrappers (optional, but handy)
// -----------------------------------------------------------------------------

// Old: evaluateForecastRiskForPlot(plotId, daysWindow, options)
async function evaluateForecastRiskForPlot(
  plotId,
  daysWindow = 7,
  options = { autoIngestIfMissing: true }
) {
  return evaluateRiskForPlot(plotId, {
    daysWindow,
    mode: "FORECAST",
    autoIngestIfMissing: options.autoIngestIfMissing,
  });
}

// Old: evaluateRiskForPlotProactive(plotId, daysWindow, options)
async function evaluateRiskForPlotProactive(
  plotId,
  daysWindow = 7,
  options = { autoIngestIfMissing: true }
) {
  return evaluateRiskForPlot(plotId, {
    daysWindow,
    mode: "PROACTIVE",
    autoIngestIfMissing: options.autoIngestIfMissing,
  });
}

// Old: evaluateRiskForAllPlotsRealWeather(daysWindow)
async function evaluateRiskForAllPlotsRealWeather(daysWindow = 7) {
  return evaluateRiskForAllPlots({
    daysWindow,
    mode: "FORECAST",
    autoIngestIfMissing: true,
  });
}

module.exports = {
  // new generic APIs
  evaluateRiskForPlot,
  evaluateRiskForAllPlots,

  // backward-compatible named APIs
  evaluateForecastRiskForPlot,
  evaluateRiskForPlotProactive,
  evaluateRiskForAllPlotsRealWeather,

  // read APIs
  getRisksForPlot,
  getLatestRisksByPlot,
};