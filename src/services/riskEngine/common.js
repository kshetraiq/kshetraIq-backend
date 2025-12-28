// src/services/riskEngine/common.js

function onlyNums(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => typeof v === "number" && Number.isFinite(v));
}

function avg(arr) {
  const nums = onlyNums(arr);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(arr) {
  const nums = onlyNums(arr);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0);
}

function clamp01(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Aggregate a weather window (arrays of daily values).
 * Works for both PAST (WeatherDaily) and FORECAST (WeatherForecast).
 */
function aggregateWeather(window) {
  if (!window) return null;

  // prefer provided tMean else compute
  const tMeanArr =
    Array.isArray(window.tMean) && window.tMean.length
      ? window.tMean
      : (Array.isArray(window.tMax) && Array.isArray(window.tMin))
        ? window.tMax.map((_, i) => ((window.tMax[i] ?? 0) + (window.tMin[i] ?? 0)) / 2)
        : [];

  const evp7 =
    Array.isArray(window.evaporation) && window.evaporation.length
      ? avg(window.evaporation)
      : 5; // neutral default

  const rainArr = Array.isArray(window.rainfall) ? window.rainfall : [];
  const fogArr = Array.isArray(window.fogFlag) ? window.fogFlag : [];
  const rainyDays = rainArr.filter((r) => typeof r === "number" && r > 0).length;
  const fogDays = fogArr.filter(Boolean).length;

  return {
    tMin7: avg(window.tMin),
    tMax7: avg(window.tMax),
    tMean7: avg(tMeanArr),

    rhM7: avg(window.rhMorning),
    rhE7: avg(window.rhEvening),

    sr7: avg(window.solarRadiation),
    sun7: avg(window.sunshineHours),

    rain7: sum(rainArr),
    rainyDays,

    // for forecast-only fields (optional)
    rainChance7: avg(window.rainChance),

    wind7: avg(window.windSpeed),
    lw7: avg(window.leafWetnessHours),
    evp7,

    // new signals (optional)
    vpd7: avg(window.vpd),
    dew7: avg(window.dewPoint),
    fogDays,
  };
}

module.exports = {
  avg,
  sum,
  clamp01,
  aggregateWeather,
};