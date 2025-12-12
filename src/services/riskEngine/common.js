// src/services/riskEngine/common.js
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sum(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function aggregateWeather(window) {
  const tMeanArr =
    window.tMean && window.tMean.length
      ? window.tMean
      : window.tMax.map((_, i) => (window.tMax[i] + window.tMin[i]) / 2);

  const hasEvap =
    Array.isArray(window.evaporation) && window.evaporation.length > 0;
  const evp7 = hasEvap ? avg(window.evaporation) : 5; // neutral default

  return {
    tMin7: avg(window.tMin),
    tMax7: avg(window.tMax),
    tMean7: avg(tMeanArr),
    rhM7: avg(window.rhMorning),
    rhE7: avg(window.rhEvening),
    sr7: avg(window.solarRadiation),
    rain7: sum(window.rainfall),
    rainyDays: window.rainfall.filter((r) => r > 0).length,
    wind7: avg(window.windSpeed),
    lw7: avg(window.leafWetnessHours),
    evp7,
    sun7: avg(window.sunshineHours),
  };
}

module.exports = {
  avg,
  sum,
  clamp01,
  aggregateWeather,
};