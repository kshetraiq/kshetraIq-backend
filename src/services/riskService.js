// src/services/riskService.js

const { Plot } = require("../models/plot");
const { WeatherDaily } = require("../models/weatherDaily");
const { WeatherForecast } = require("../models/weatherForecast");
const { RiskEvent } = require("../models/riskEvent");

const {
  DiseaseObservation,
  DISEASE_TYPES,
} = require("../models/diseaseObservation");

const { evaluateRiceDiseaseRiskV2 } = require("./riskEngine/riceDiseases");
const { evaluateRiskForChilli } = require("./riskEngine/chilliDiseases");
const { evaluateRiskForBlackGram } = require("./riskEngine/blackgramDiseases");
const { evaluateRiskForMaize } = require("./riskEngine/maizeDiseases");

const {
  ingestWeatherForPlotFromOpenMeteo,
  syncDailyArchive,
} = require("./weatherIngestSerivice");

/* ------------------------------- helpers ------------------------------- */

function inferCropStage(sowingDate, refDate = new Date()) {
  if (!sowingDate) return "unknown";
  const s = new Date(sowingDate);
  const diffDays = Math.floor((refDate - s) / (1000 * 60 * 60 * 24));
  if (diffDays <= 20) return "nursery";
  if (diffDays <= 45) return "tillering";
  if (diffDays <= 65) return "panicle-init";
  if (diffDays <= 80) return "booting";
  if (diffDays <= 100) return "heading";
  return "maturity";
}

function normalizeDateToMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function classifyScore(score) {
  let level = "GREEN";
  if (score >= 75) level = "RED";
  else if (score >= 50) level = "ORANGE";
  else if (score >= 30) level = "YELLOW";
  return level;
}

function estimateLeafWetnessHoursGeneric({ rhMean, rainfallMm, rainChance, fogFlag }) {
  // conservative fallback for forecast days (since WeatherForecast has limited RH info)
  if (fogFlag) return 6;
  if (typeof rainfallMm === "number" && rainfallMm > 0) return 8;
  if (typeof rainChance === "number" && rainChance >= 60) return 6;
  if (typeof rhMean === "number" && rhMean >= 90) return 6;
  if (typeof rhMean === "number" && rhMean >= 85) return 3;
  return 0;
}

function dateToYMD(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function listDateRangeYMD(start, end) {
  const out = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (cur <= e) {
    out.push(dateToYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Ensure WeatherDaily has required past days by backfilling missing dates (sequential).
 * This gives best risk quality for PAST / PROACTIVE.
 */
async function ensureDailyArchiveRange(plotId, startDate, endDate) {
  const days = listDateRangeYMD(startDate, endDate);

  const existing = await WeatherDaily.find({
    plot: plotId,
    date: { $gte: startDate, $lte: endDate },
  })
    .select({ date: 1 })
    .lean();

  const existingSet = new Set(existing.map((d) => dateToYMD(d.date)));
  const missing = days.filter((d) => !existingSet.has(d));

  for (const ymd of missing) {
    try {
      await syncDailyArchive(plotId, ymd);
    } catch (e) {
      // don't break: partial data is still useful
      console.error(`❌ syncDailyArchive failed for ${plotId} ${ymd}:`, e.message);
    }
  }

  return { requested: days.length, missingFilled: missing.length };
}

/* ------------------ WINDOW BUILDER: PAST vs FORECAST ------------------ */

async function buildWeatherWindowForPlot({
  plot,
  daysWindow = 7,
  windowType = "FORECAST", // "PAST" | "FORECAST"
}) {
  const now = new Date();

  let startDate, endDate;

  if (windowType === "PAST") {
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (daysWindow - 1));
  } else {
    // tomorrow → D+daysWindow
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysWindow, 23, 59, 59, 999);
  }

  // Best quality: for PAST ensure archive exists
  if (windowType === "PAST") {
    await ensureDailyArchiveRange(plot._id, startDate, endDate);
  }

  const query = {
    plot: plot._id,
    date: { $gte: startDate, $lte: endDate },
  };

  const weatherDocs =
    windowType === "PAST"
      ? await WeatherDaily.find(query).sort({ date: 1 }).lean()
      : await WeatherForecast.find(query).sort({ date: 1 }).lean();

  if (!weatherDocs?.length) return null;

  const latestObs = await DiseaseObservation.findOne({ plot: plot._id })
    .sort({ observationDate: -1 })
    .lean();

  const firstDate = weatherDocs[0].date;
  const lastDate = weatherDocs[weatherDocs.length - 1].date;
  const midDate = new Date((firstDate.getTime() + lastDate.getTime()) / 2);

  const cropStage =
    latestObs?.cropStage || inferCropStage(plot.sowingDate, midDate);

  const management = {
    nitrogenLevel: latestObs?.nitrogenLevel || null,
    waterStatus: latestObs?.waterStatus || null,
  };

  const dates = [];
  const tMin = [];
  const tMax = [];
  const tMean = [];

  const rhMorning = [];
  const rhEvening = [];

  const rainfall = [];
  const rainChance = []; // forecast only (still okay to include for both)
  const windSpeed = [];
  const solarRadiation = [];
  const sunshineHours = [];
  const leafWetnessHours = [];

  // new drivers
  const vpd = [];
  const dewPoint = [];
  const fogFlag = [];
  const evaporation = []; // use ET0 when available

  for (const d of weatherDocs) {
    dates.push(dateToYMD(d.date));

    const _tMin = typeof d.tMin === "number" ? d.tMin : 0;
    const _tMax = typeof d.tMax === "number" ? d.tMax : 0;
    const _tMean =
      typeof d.tMean === "number" ? d.tMean : (_tMin && _tMax ? (_tMin + _tMax) / 2 : 0);

    tMin.push(_tMin);
    tMax.push(_tMax);
    tMean.push(_tMean);

    // Humidity: PAST has rhMorning/rhEvening; FORECAST has humidityMean (optional)
    const rhMean =
      typeof d.rhMean === "number" ? d.rhMean :
        typeof d.humidityMean === "number" ? d.humidityMean :
          null;

    const rhM =
      typeof d.rhMorning === "number" ? d.rhMorning :
        (rhMean != null ? rhMean : 0);

    const rhE =
      typeof d.rhEvening === "number" ? d.rhEvening :
        (rhMean != null ? rhMean : 0);

    rhMorning.push(rhM);
    rhEvening.push(rhE);

    // Rainfall
    const rainMm = typeof d.rainfallMm === "number" ? d.rainfallMm : 0;
    rainfall.push(rainMm);

    // Forecast rain chance
    const rc = typeof d.rainChance === "number" ? d.rainChance : 0;
    rainChance.push(rc);

    // Wind: daily uses windSpeed; forecast uses windSpeedMax
    const w =
      typeof d.windSpeed === "number" ? d.windSpeed :
        typeof d.windSpeedMax === "number" ? d.windSpeedMax : 0;
    windSpeed.push(w);

    // Radiation & sunshine
    solarRadiation.push(typeof d.solarRadiation === "number" ? d.solarRadiation : 0);
    sunshineHours.push(typeof d.sunshineHours === "number" ? d.sunshineHours : 0);

    // Fog: daily has fogFlag; forecast has fogFlag (optional)
    const fog = !!d.fogFlag;
    fogFlag.push(fog);

    // Leaf wetness: daily has leafWetnessHours; forecast has leafWetnessHours (optional)
    const lwh =
      typeof d.leafWetnessHours === "number"
        ? d.leafWetnessHours
        : estimateLeafWetnessHoursGeneric({
          rhMean,
          rainfallMm: rainMm,
          rainChance: rc,
          fogFlag: fog,
        });
    leafWetnessHours.push(lwh);

    // vpd/dew/et0: only PAST has vpdMean/dewPointMean/et0
    vpd.push(typeof d.vpdMean === "number" ? d.vpdMean : 0);
    dewPoint.push(typeof d.dewPointMean === "number" ? d.dewPointMean : 0);
    evaporation.push(typeof d.et0 === "number" ? d.et0 : 0);
  }

  return {
    dates,
    tMin,
    tMax,
    tMean,
    rhMorning,
    rhEvening,
    rainfall,
    rainChance,
    windSpeed,
    solarRadiation,
    sunshineHours,
    leafWetnessHours,

    vpd,
    dewPoint,
    fogFlag,
    evaporation,

    cropStage,
    management,

    meta: {
      windowType,
      daysWindow,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      lat: plot.location?.lat,
      lon: plot.location?.lng,
      district: plot.district,
      mandal: plot.mandal,
      crop: plot.crop,
      variety: plot.variety,
    },
  };
}

/* ----------------------------- CORE EVALUATOR ----------------------------- */

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

  // Helper to dispatch to correct engine
  const evaluateDisease = (disease, window) => {
    // Rice/Paddy
    if (disease.startsWith("PADDY_")) return evaluateRiceDiseaseRiskV2(disease, window);
    // Chilli
    if (disease.startsWith("CHILLI_")) return evaluateRiskForChilli(disease, window);
    // Black Gram
    if (disease.startsWith("BLACKGRAM_")) return evaluateRiskForBlackGram(disease, window);
    // Maize
    if (disease.startsWith("MAIZE_")) return evaluateRiskForMaize(disease, window);

    // Fallback
    return { score: 0, level: "GREEN", explanation: "Unknown disease type" };
  };

  // Filter relevant diseases for the plot's crop
  const cropUpper = (plot.crop || "").toUpperCase();
  const relevantDiseases = DISEASE_TYPES.filter(d => {
    if (cropUpper.includes("RICE") || cropUpper.includes("PADDY")) return d.startsWith("PADDY_");
    if (cropUpper.includes("CHILLI") || cropUpper.includes("MIRCHI")) return d.startsWith("CHILLI_");
    if (cropUpper.includes("BLACK") || cropUpper.includes("GRAM") || cropUpper.includes("MINUMU")) return d.startsWith("BLACKGRAM_");
    if (cropUpper.includes("MAIZE") || cropUpper.includes("CORN") || cropUpper.includes("MAKKA")) return d.startsWith("MAIZE_");
    // If unknown crop, maybe compute nothing or everything? Let's skip to avoid noise.
    return false;
  });

  if (relevantDiseases.length === 0) {
    // If we want to be safe, maybe we log a warning but return empty risks
    // console.warn(`No matching diseases found for plot crop: ${plot.crop}`);
    return { plot, mode, risks: [], message: `No supported diseases for crop: ${plot.crop}` };
  }

  // PROACTIVE = combine PAST + FORECAST
  if (mode === "PROACTIVE") {
    let pastWindow = await buildWeatherWindowForPlot({ plot, daysWindow, windowType: "PAST" });
    let futureWindow = await buildWeatherWindowForPlot({ plot, daysWindow, windowType: "FORECAST" });

    const needsForecast =
      !futureWindow || !Array.isArray(futureWindow.dates) || futureWindow.dates.length < daysWindow;

    if (needsForecast && autoIngestIfMissing) {
      await ingestWeatherForPlotFromOpenMeteo(plot._id.toString(), daysWindow);
      futureWindow = await buildWeatherWindowForPlot({ plot, daysWindow, windowType: "FORECAST" });
    }

    if ((!pastWindow || !pastWindow.dates?.length) && (!futureWindow || !futureWindow.dates?.length)) {
      return { plot, mode, risks: [], message: "No weather data (past or forecast) for plot" };
    }

    for (const disease of relevantDiseases) {
      const rPast = pastWindow?.dates?.length ? evaluateDisease(disease, pastWindow) : null;
      const rFuture = futureWindow?.dates?.length ? evaluateDisease(disease, futureWindow) : null;

      const pastScore = rPast?.score ?? 0;
      const futureScore = rFuture?.score ?? 0;

      const combinedScore = Math.round(pastWeight * pastScore + futureWeight * futureScore);
      const combinedLevel = classifyScore(combinedScore);

      const explanation = `Past ${daysWindow}d: ${rPast?.level ?? "NA"} (${pastScore}) | Next ${daysWindow}d: ${rFuture?.level ?? "NA"} (${futureScore})`;

      const drivers = {
        past: rPast || null,
        future: rFuture || null,
        weights: { pastWeight, futureWeight },
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

  // single-window modes
  const windowType = mode === "PAST" ? "PAST" : "FORECAST";

  let window = await buildWeatherWindowForPlot({ plot, daysWindow, windowType });

  const needsIngestForecast =
    windowType === "FORECAST" &&
    (!window || !Array.isArray(window.dates) || window.dates.length < daysWindow);

  if (needsIngestForecast && autoIngestIfMissing) {
    await ingestWeatherForPlotFromOpenMeteo(plot._id.toString(), daysWindow);
    window = await buildWeatherWindowForPlot({ plot, daysWindow, windowType });
  }

  if (!window?.dates?.length) {
    return { plot, mode, risks: [], message: `No weather data available for ${windowType}` };
  }

  const source = mode === "PAST" ? "WEATHER_V2_PAST" : "WEATHER_V2_FORECAST";

  for (const disease of relevantDiseases) {
    const r = evaluateDisease(disease, window);

    const riskEvent = await RiskEvent.findOneAndUpdate(
      { plot: plot._id, disease, date: today, source },
      {
        plot: plot._id,
        disease,
        date: today,
        severity: r.level,
        score: r.score,
        horizonDays: daysWindow,
        explanation: r.explanation,
        drivers: r, // store full detail: score/level/explanation/drivers/meta
        source,
        createdBy: "RULE_ENGINE",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    riskEvents.push(riskEvent);
  }

  return { plot, mode, risks: riskEvents };
}

async function evaluateRiskForAllPlots({
  daysWindow = 7,
  mode = "FORECAST",
  autoIngestIfMissing = true,
  pastWeight = 0.4,
  futureWeight = 0.6,
} = {}) {
  const plots = await Plot.find({});
  const results = [];

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
      console.error(`Failed risk eval for plot ${plot._id}:`, err.message);
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

async function getRisksForPlot(plotId) {
  return RiskEvent.find({ plot: plotId })
    .sort({ date: -1, disease: 1 })
    .lean();
}

async function getLatestRisksByPlot(filters = {}) {
  const matchPlots = {};
  if (filters.district) matchPlots.district = filters.district;
  if (filters.mandal) matchPlots.mandal = filters.mandal;

  const plots = await Plot.find(matchPlots).lean();
  const plotIds = plots.map((p) => p._id);
  if (!plotIds.length) return [];

  const latestRisks = await RiskEvent.aggregate([
    { $match: { plot: { $in: plotIds } } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: { plot: "$plot", disease: "$disease" },
        doc: { $first: "$$ROOT" },
      },
    },
  ]);

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
      latestRisks: {},
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

module.exports = {
  evaluateRiskForPlot,
  evaluateRiskForAllPlots,
  getRisksForPlot,
  getLatestRisksByPlot,
};