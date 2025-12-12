// src/services/riskEngine/riceDiseases.js
// Multi-disease rice risk engine (Blast, BLB, Sheath blight, Brown spot)

const { clamp01, aggregateWeather } = require("./common");

/**
 * Seasonal multiplier for blast based on date
 * (derived from TN/Coimbatore seasonal pattern and adapted).
 */
function seasonalBlastMultiplier(date) {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const md = m * 100 + d;

  // mid-Nov → Jan end: severe blast season
  if (md >= 1115 || md <= 131) return 1.4;

  // Sep → mid-Nov, early Feb: high risk windows
  if ((md >= 901 && md <= 1114) || (md >= 201 && md <= 215)) return 1.2;

  // mid-Apr → mid-Jun: very low blast period (hot & dry)
  if (md >= 415 && md <= 615) return 0.6;

  // default
  return 1.0;
}

/**
 * Stage multiplier – disease-specific sensitivity to crop stage
 */
function stageMultiplier(stage, disease) {
  switch (disease) {
    case "PADDY_BLAST":
      // blast: nursery → heading, peak from tillering to heading
      if (["tillering", "panicle-init", "booting", "heading"].includes(stage)) return 1.2;
      if (stage === "maturity") return 0.7;
      return 1.0;

    case "PADDY_BLB":
      // BLB: tillering to booting/heading
      if (["tillering", "panicle-init", "booting", "heading"].includes(stage)) return 1.2;
      return 0.9;

    case "PADDY_SHEATH_BLIGHT":
      // sheath blight: dense canopy & later stages
      if (["panicle-init", "booting", "heading"].includes(stage)) return 1.3;
      if (stage === "tillering") return 1.0;
      return 0.8;

    case "PADDY_BROWN_SPOT":
      // brown spot: all stages, but stress later matters more
      if (["tillering", "panicle-init", "booting"].includes(stage)) return 1.1;
      return 1.0;

    default:
      return 1.0;
  }
}

/**
 * Rice blast scoring from aggregated weather.
 * WeatherAgg: output of aggregateWeather(window).
 */
function scoreBlast(weatherAgg) {
  const { tMin7, rhM7, rhE7, sr7, rain7, lw7, evp7 } = weatherAgg;

  // cooler nights → higher risk (18–25°C window)
  const tMinRisk = clamp01((25 - tMin7) / 7);      // 1 if ~18°C, ~0 if ≥25–26°C

  // high humidity (morning/evening)
  const rhMScore = clamp01((rhM7 - 75) / 20);      // 75–95%
  const rhEScore = clamp01((rhE7 - 60) / 25);      // 60–85%

// Use Open-Meteo MJ m⁻² day⁻¹ scale (≈10–25 MJ typical)
const srScore = clamp01((18 - sr7) / 6); // ≤12 → 1 (cloudy), ≥24 → 0 (sunny)

  // more leaf wetness = higher risk
  const lwScore  = clamp01(lw7 / 10);              // 0–10 h/day

  // recent rain supports infection but saturates
  const rainScore = clamp01(rain7 / 80);           // up to ~80 mm/week

  // low evaporation → more humid
  
  const evpScore  = clamp01((5 - evp7) / 3);       // 2–5 mm/day typical

  // weights reflect regression + sensitivity (SR highest)
  const raw =
    1.6 * srScore +
    1.2 * tMinRisk +
    1.0 * rhMScore +
    0.6 * rhEScore +
    0.7 * lwScore +
    0.4 * evpScore +
    0.3 * rainScore;

  // squash to 0–1
  const risk01 = 1 / (1 + Math.exp(-(raw - 2.5)));

  return {
    risk01,
    drivers: { tMinRisk, rhMScore, rhEScore, srScore, lwScore, rainScore, evpScore },
  };
}

/**
 * BLB scoring – warm, humid, with rain and wind splash, high N.
 */
function scoreBLB(weatherAgg, management) {
  const { tMean7, rhM7, rhE7, rain7, rainyDays, wind7, evp7 } = weatherAgg;

  const tempScore = clamp01((tMean7 - 22) / 10);         // 22–32°C
  const rhScore   = clamp01((Math.max(rhM7, rhE7) - 75) / 20); // RH 75–95%
  const rainFreq  = clamp01(rainyDays / 5);              // 0–5 rainy days
  const rainAmt   = clamp01(rain7 / 100);                // up to 100 mm/week
  const windScore = clamp01(wind7 / 3);                  // up to ~3 m/s
  const lowEvp    = clamp01((5 - evp7) / 3);             // low evap = humid

  const highN =
    management?.nitrogenLevel === "HIGH" ? 1 :
    management?.nitrogenLevel === "MEDIUM" ? 0.5 : 0;

  const raw =
    1.1 * tempScore +
    1.1 * rhScore +
    0.7 * rainFreq +
    0.4 * rainAmt +
    0.4 * windScore +
    0.4 * lowEvp +
    0.5 * highN;

  const risk01 = 1 / (1 + Math.exp(-(raw - 2.3)));

  return {
    risk01,
    drivers: { tempScore, rhScore, rainFreq, rainAmt, windScore, lowEvp, highN },
  };
}

/**
 * Sheath blight – very humid, warm, long leaf wetness,
 * dense canopy, high N, continuous flooding.
 */
function scoreSheathBlight(weatherAgg, management) {
  const { tMean7, rhM7, rhE7, lw7, rain7, rainyDays } = weatherAgg;

  const tempScore = clamp01((tMean7 - 24) / 8);           // 24–32°C
  const rhScore   = clamp01((Math.max(rhM7, rhE7) - 80) / 15); // 80–95%
  const lwScore   = clamp01(lw7 / 10);                    // 0–10 h/day
  const rainFreq  = clamp01(rainyDays / 5);
  const rainAmt   = clamp01(rain7 / 80);

  const highN =
    management?.nitrogenLevel === "HIGH" ? 1 :
    management?.nitrogenLevel === "MEDIUM" ? 0.5 : 0;

  const flooded =
    management?.waterStatus === "FLOODED" ? 1 :
    management?.waterStatus === "NORMAL" ? 0.5 : 0;

  const raw =
    1.1 * tempScore +
    1.2 * rhScore +
    1.0 * lwScore +
    0.4 * rainFreq +
    0.3 * rainAmt +
    0.6 * highN +
    0.5 * flooded;

  const risk01 = 1 / (1 + Math.exp(-(raw - 2.4)));

  return {
    risk01,
    drivers: { tempScore, rhScore, lwScore, rainFreq, rainAmt, highN, flooded },
  };
}

/**
 * Brown spot – associated with stress: low fertility, water stress, low rain.
 */
function scoreBrownSpot(weatherAgg, management) {
  const { tMean7, rhM7, rain7 } = weatherAgg;

  const tempScore = clamp01((tMean7 - 20) / 10);       // 20–30°C
  const rhScore   = clamp01((rhM7 - 60) / 20);         // 60–80% moderate humidity

  const lowRain   = clamp01((40 - rain7) / 40);        // less rain → more stress

  const stressWater =
    management?.waterStatus === "STRESSED" ? 1 :
    management?.waterStatus === "NORMAL" ? 0.3 : 0;

  const lowN =
    management?.nitrogenLevel === "LOW" ? 1 :
    management?.nitrogenLevel === "MEDIUM" ? 0.5 : 0;

  const raw =
    0.8 * tempScore +
    0.6 * rhScore +
    0.8 * lowRain +
    0.7 * stressWater +
    0.6 * lowN;

  const risk01 = 1 / (1 + Math.exp(-(raw - 2.0)));

  return {
    risk01,
    drivers: { tempScore, rhScore, lowRain, stressWater, lowN },
  };
}

/**
 * Convert 0–1 risk to score 0–100 + level
 */
function classifyRisk(risk01) {
  const score = Math.round(risk01 * 100);
  let level = "GREEN";
  if (score >= 75) level = "RED";
  else if (score >= 50) level = "ORANGE";
  else if (score >= 30) level = "YELLOW";
  return { score, level };
}

/**
 * Main entry: evaluateRiceDiseaseRiskV2
 *
 * @param {string} disease  - "PADDY_BLAST" | "PADDY_BLB" | "PADDY_SHEATH_BLIGHT" | "PADDY_BROWN_SPOT"
 * @param {object} window   - weather window object built in riskService (7-day arrays + cropStage + management)
 * @returns { score, level, explanation, drivers }
 */
function evaluateRiceDiseaseRiskV2(disease, window) {
  if (!window || !window.dates || window.dates.length === 0) {
    return {
      score: 0,
      level: "GREEN",
      explanation: "No recent weather data",
      drivers: {},
    };
  }

  const agg = aggregateWeather(window);
  const now = new Date(window.dates[window.dates.length - 1]);

  let risk01 = 0;
  let drivers = {};

  if (disease === "PADDY_BLAST") {
    const r = scoreBlast(agg);
    risk01 = r.risk01;
    drivers = r.drivers;
    // apply blast seasonality
    risk01 *= seasonalBlastMultiplier(now);
  } else if (disease === "PADDY_BLB") {
    const r = scoreBLB(agg, window.management);
    risk01 = r.risk01;
    drivers = r.drivers;
  } else if (disease === "PADDY_SHEATH_BLIGHT") {
    const r = scoreSheathBlight(agg, window.management);
    risk01 = r.risk01;
    drivers = r.drivers;
  } else if (disease === "PADDY_BROWN_SPOT") {
    const r = scoreBrownSpot(agg, window.management);
    risk01 = r.risk01;
    drivers = r.drivers;
  } else {
    // unknown disease → no risk
    return {
      score: 0,
      level: "GREEN",
      explanation: "Disease not supported in risk engine",
      drivers: {},
    };
  }

  // stage adjustment
  risk01 *= stageMultiplier(window.cropStage, disease);
  // clamp to 0–1
  risk01 = Math.max(0, Math.min(1, risk01));

  const { score, level } = classifyRisk(risk01);

  // Build human explanation from main positive drivers
  const explanationParts = [];

  // These checks are generic – only push if that driver exists and is high.
  if (drivers.tMinRisk !== undefined && drivers.tMinRisk > 0.5) {
    explanationParts.push("favourable night temperature");
  }
  if (drivers.rhMScore !== undefined && drivers.rhMScore > 0.5) {
    explanationParts.push("high morning humidity");
  }
  if (drivers.rhScore !== undefined && drivers.rhScore > 0.5) {
    explanationParts.push("high humidity");
  }
  if (drivers.srScore !== undefined && drivers.srScore > 0.5) {
    explanationParts.push("low solar radiation (cloudy conditions)");
  }
  if (drivers.lwScore !== undefined && drivers.lwScore > 0.5) {
    explanationParts.push("long leaf wetness duration");
  }
  if (drivers.rainFreq !== undefined && drivers.rainFreq > 0.5) {
    explanationParts.push("frequent rainfall events");
  }
  if (drivers.lowRain !== undefined && drivers.lowRain > 0.5) {
    explanationParts.push("low rainfall and possible water stress");
  }
  if (drivers.highN !== undefined && drivers.highN > 0.5) {
    explanationParts.push("high nitrogen level");
  }
  if (drivers.stressWater !== undefined && drivers.stressWater > 0.5) {
    explanationParts.push("reported water stress in field");
  }
  if (drivers.flooded !== undefined && drivers.flooded > 0.5) {
    explanationParts.push("continuous flooding and dense canopy");
  }

  const explanation =
    explanationParts.length > 0
      ? explanationParts.join("; ")
      : "Weather and crop conditions are not strongly favourable";

  return {
    score,       // 0–100
    level,       // "GREEN" | "YELLOW" | "ORANGE" | "RED"
    explanation,
    drivers,
  };
}

module.exports = {
  evaluateRiceDiseaseRiskV2,
};