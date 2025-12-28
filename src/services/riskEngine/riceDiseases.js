// src/services/riskEngine/riceDiseases.js
// Multi-disease rice risk engine (Blast, BLB, Sheath blight, Brown spot)

const { clamp01, aggregateWeather } = require("./common");

/** Seasonal multiplier for blast (rough) */
function seasonalBlastMultiplier(date) {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const md = m * 100 + d;

  if (md >= 1115 || md <= 131) return 1.4;
  if ((md >= 901 && md <= 1114) || (md >= 201 && md <= 215)) return 1.2;
  if (md >= 415 && md <= 615) return 0.6;
  return 1.0;
}

/** Crop stage sensitivity */
function stageMultiplier(stage, disease) {
  switch (disease) {
    case "PADDY_BLAST":
      if (["tillering", "panicle-init", "booting", "heading"].includes(stage)) return 1.2;
      if (stage === "maturity") return 0.7;
      return 1.0;

    case "PADDY_BLB":
      if (["tillering", "panicle-init", "booting", "heading"].includes(stage)) return 1.2;
      return 0.9;

    case "PADDY_SHEATH_BLIGHT":
      if (["panicle-init", "booting", "heading"].includes(stage)) return 1.3;
      if (stage === "tillering") return 1.0;
      return 0.8;

    case "PADDY_BROWN_SPOT":
      if (["tillering", "panicle-init", "booting"].includes(stage)) return 1.1;
      return 1.0;

    default:
      return 1.0;
  }
}

/**
 * BLAST – now uses (if available): vpd7, dew7, fogDays
 */
function scoreBlast(agg) {
  const { tMin7, rhM7, rhE7, sr7, rain7, lw7, evp7, vpd7, dew7, fogDays } = agg;

  const tMinRisk = clamp01((25 - tMin7) / 7);             // ~18°C => high
  const rhMScore = clamp01((rhM7 - 75) / 20);             // 75–95
  const rhEScore = clamp01((rhE7 - 60) / 25);             // 60–85

  // Open-Meteo shortwave_radiation_sum ~ MJ/m²/day (typical ~10–25)
  const srScore = clamp01((18 - sr7) / 6);                // cloudy => higher risk
  const lwScore = clamp01(lw7 / 10);                      // 0–10 hours/day
  const rainScore = clamp01(rain7 / 80);                  // up to 80 mm/week
  const evpScore = clamp01((5 - evp7) / 3);               // low evap => more humid

  // NEW: low VPD => humid; fog days => persistent wetness; dew point higher => condensation likely
  const vpdScore = (typeof vpd7 === "number" && Number.isFinite(vpd7))
    ? clamp01((1.2 - vpd7) / 0.8)                          // <=0.4 → 1, >=1.2 → 0
    : 0;

  const fogScore = (typeof fogDays === "number" && Number.isFinite(fogDays))
    ? clamp01(fogDays / 3)                                 // 0–3 days
    : 0;

  const dewScore = (typeof dew7 === "number" && Number.isFinite(dew7))
    ? clamp01((dew7 - 18) / 6)                              // 18–24°C dewpoint
    : 0;

  const contributions = {
    srScore: 1.6 * srScore,
    tMinRisk: 1.2 * tMinRisk,
    rhMScore: 1.0 * rhMScore,
    rhEScore: 0.6 * rhEScore,
    lwScore: 0.7 * lwScore,
    evpScore: 0.4 * evpScore,
    rainScore: 0.3 * rainScore,
    vpdScore: 0.6 * vpdScore,
    fogScore: 0.4 * fogScore,
    dewScore: 0.3 * dewScore,
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
  const risk01 = 1 / (1 + Math.exp(-(raw - 2.5)));

  return { risk01, drivers: { tMinRisk, rhMScore, rhEScore, srScore, lwScore, rainScore, evpScore, vpdScore, fogScore, dewScore }, contributions };
}

function scoreBLB(agg, management) {
  const { tMean7, rhM7, rhE7, rain7, rainyDays, wind7, evp7, vpd7 } = agg;

  const tempScore = clamp01((tMean7 - 22) / 10); // 22–32
  const rhScore = clamp01((Math.max(rhM7, rhE7) - 75) / 20);
  const rainFreq = clamp01(rainyDays / 5);
  const rainAmt = clamp01(rain7 / 100);
  const windScore = clamp01(wind7 / 3);
  const lowEvp = clamp01((5 - evp7) / 3);

  const vpdScore = (typeof vpd7 === "number" && Number.isFinite(vpd7))
    ? clamp01((1.3 - vpd7) / 0.9)
    : 0;

  const highN =
    management?.nitrogenLevel === "HIGH" ? 1 :
    management?.nitrogenLevel === "MEDIUM" ? 0.5 : 0;

  const contributions = {
    tempScore: 1.1 * tempScore,
    rhScore: 1.1 * rhScore,
    rainFreq: 0.7 * rainFreq,
    rainAmt: 0.4 * rainAmt,
    windScore: 0.4 * windScore,
    lowEvp: 0.4 * lowEvp,
    highN: 0.5 * highN,
    vpdScore: 0.3 * vpdScore,
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
  const risk01 = 1 / (1 + Math.exp(-(raw - 2.3)));

  return { risk01, drivers: { tempScore, rhScore, rainFreq, rainAmt, windScore, lowEvp, highN, vpdScore }, contributions };
}

function scoreSheathBlight(agg, management) {
  const { tMean7, rhM7, rhE7, lw7, rain7, rainyDays, vpd7 } = agg;

  const tempScore = clamp01((tMean7 - 24) / 8);
  const rhScore = clamp01((Math.max(rhM7, rhE7) - 80) / 15);
  const lwScore = clamp01(lw7 / 10);
  const rainFreq = clamp01(rainyDays / 5);
  const rainAmt = clamp01(rain7 / 80);

  const vpdScore = (typeof vpd7 === "number" && Number.isFinite(vpd7))
    ? clamp01((1.1 - vpd7) / 0.8)
    : 0;

  const highN =
    management?.nitrogenLevel === "HIGH" ? 1 :
    management?.nitrogenLevel === "MEDIUM" ? 0.5 : 0;

  const flooded =
    management?.waterStatus === "FLOODED" ? 1 :
    management?.waterStatus === "NORMAL" ? 0.5 : 0;

  const contributions = {
    tempScore: 1.1 * tempScore,
    rhScore: 1.2 * rhScore,
    lwScore: 1.0 * lwScore,
    rainFreq: 0.4 * rainFreq,
    rainAmt: 0.3 * rainAmt,
    highN: 0.6 * highN,
    flooded: 0.5 * flooded,
    vpdScore: 0.3 * vpdScore,
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
  const risk01 = 1 / (1 + Math.exp(-(raw - 2.4)));

  return { risk01, drivers: { tempScore, rhScore, lwScore, rainFreq, rainAmt, highN, flooded, vpdScore }, contributions };
}

function scoreBrownSpot(agg, management) {
  const { tMean7, rhM7, rain7, evp7 } = agg;

  const tempScore = clamp01((tMean7 - 20) / 10);
  const rhScore = clamp01((rhM7 - 60) / 20);

  // stress: low rain + higher evap
  const lowRain = clamp01((40 - rain7) / 40);
  const highEvp = clamp01((evp7 - 5) / 3);

  const stressWater =
    management?.waterStatus === "STRESSED" ? 1 :
    management?.waterStatus === "NORMAL" ? 0.3 : 0;

  const lowN =
    management?.nitrogenLevel === "LOW" ? 1 :
    management?.nitrogenLevel === "MEDIUM" ? 0.5 : 0;

  const contributions = {
    tempScore: 0.8 * tempScore,
    rhScore: 0.6 * rhScore,
    lowRain: 0.8 * lowRain,
    highEvp: 0.4 * highEvp,
    stressWater: 0.7 * stressWater,
    lowN: 0.6 * lowN,
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
  const risk01 = 1 / (1 + Math.exp(-(raw - 2.0)));

  return { risk01, drivers: { tempScore, rhScore, lowRain, highEvp, stressWater, lowN }, contributions };
}

function classifyRisk(risk01) {
  const score = Math.round(clamp01(risk01) * 100);
  let level = "GREEN";
  if (score >= 75) level = "RED";
  else if (score >= 50) level = "ORANGE";
  else if (score >= 30) level = "YELLOW";
  return { score, level };
}

function topDriverText(contributions, max = 3) {
  if (!contributions) return "";
  const sorted = Object.entries(contributions)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, max)
    .map(([k]) => {
      const map = {
        srScore: "low solar radiation (cloudy)",
        tMinRisk: "favourable cool nights",
        rhMScore: "high morning humidity",
        rhEScore: "high evening humidity",
        lwScore: "long leaf wetness",
        rainScore: "recent rainfall",
        rainFreq: "frequent rainy days",
        rainAmt: "high weekly rainfall",
        windScore: "wind-driven splash",
        lowEvp: "low evaporation (humid)",
        vpdScore: "low VPD (humid air)",
        fogScore: "foggy days",
        dewScore: "high dew point",
        tempScore: "warm temperature window",
        rhScore: "high humidity",
        highN: "high nitrogen level",
        flooded: "continuous flooding",
        lowRain: "low rainfall stress",
        highEvp: "high evap stress",
        stressWater: "reported water stress",
        lowN: "low nitrogen stress",
      };
      return map[k] || k;
    });
  return sorted.join("; ");
}

function evaluateRiceDiseaseRiskV2(disease, window) {
  if (!window || !Array.isArray(window.dates) || window.dates.length === 0) {
    return { score: 0, level: "GREEN", explanation: "No recent weather data", drivers: {}, meta: window?.meta || null };
  }

  const agg = aggregateWeather(window);
  const now = new Date(window.dates[window.dates.length - 1]);

  let risk01 = 0;
  let drivers = {};
  let contributions = {};

  if (disease === "PADDY_BLAST") {
    const r = scoreBlast(agg);
    risk01 = r.risk01 * seasonalBlastMultiplier(now);
    drivers = r.drivers;
    contributions = r.contributions;
  } else if (disease === "PADDY_BLB") {
    const r = scoreBLB(agg, window.management);
    risk01 = r.risk01;
    drivers = r.drivers;
    contributions = r.contributions;
  } else if (disease === "PADDY_SHEATH_BLIGHT") {
    const r = scoreSheathBlight(agg, window.management);
    risk01 = r.risk01;
    drivers = r.drivers;
    contributions = r.contributions;
  } else if (disease === "PADDY_BROWN_SPOT") {
    const r = scoreBrownSpot(agg, window.management);
    risk01 = r.risk01;
    drivers = r.drivers;
    contributions = r.contributions;
  } else {
    return { score: 0, level: "GREEN", explanation: "Disease not supported", drivers: {}, meta: window.meta || null };
  }

  // stage adjustment
  risk01 *= stageMultiplier(window.cropStage, disease);
  risk01 = clamp01(risk01);

  const { score, level } = classifyRisk(risk01);

  const keyDrivers = topDriverText(contributions, 3);
  const explanation = keyDrivers
    ? `Main drivers: ${keyDrivers}`
    : "Weather and crop conditions are not strongly favourable";

  return {
    score,
    level,
    explanation,
    drivers,
    meta: window.meta || null,
  };
}

module.exports = {
  evaluateRiceDiseaseRiskV2,
};