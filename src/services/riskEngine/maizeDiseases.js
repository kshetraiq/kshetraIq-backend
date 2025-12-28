const { clamp01, aggregateWeather } = require("./common");

function scoreFAW(agg) {
    const { tMean7, rain7 } = agg;
    // Fall Armyworm: Temp 25-30 optimal. Heavy rain washes larvae.
    const tempScore = clamp01(1 - Math.abs(tMean7 - 28) / 5);
    // Rainfall > 30mm reduces risk significantly
    const rainSuppression = clamp01((30 - rain7) / 30); // 1 if 0mm, 0 if >30mm

    const contributions = {
        tempScore: 1.5 * tempScore,
        rainSuppression: 1.2 * rainSuppression // High rain = low score
    };
    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 1.8)));
    return { risk01, contributions, drivers: { tempScore, rainSuppression } };
}

function scoreLeafBlight(agg) {
    const { tMean7, rhM7, lw7 } = agg;
    // TLB: Cool (18-27) + High Humidity + LW
    const tempScore = clamp01((28 - tMean7) / 10); // Lower is better (down to 18)
    const rhScore = clamp01((rhM7 - 80) / 15);
    const lwScore = clamp01(lw7 / 8);

    const contributions = {
        tempScore: 0.8 * tempScore,
        rhScore: 1.0 * rhScore,
        lwScore: 1.2 * lwScore
    };
    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 2.0)));
    return { risk01, contributions, drivers: { tempScore, rhScore, lwScore } };
}

function classifyRisk(risk01) {
    const score = Math.round(clamp01(risk01) * 100);
    let level = "GREEN";
    if (score >= 75) level = "RED";
    else if (score >= 50) level = "ORANGE";
    else if (score >= 30) level = "YELLOW";
    return { score, level };
}

function topDriverText(contributions) {
    if (!contributions) return "";
    return Object.entries(contributions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k]) => k.replace("Score", ""))
        .join(", ");
}

function evaluateRiskForMaize(disease, window) {
    if (!window || !window.dates || !window.dates.length) return { score: 0, level: "GREEN" };
    const agg = aggregateWeather(window);
    let res = { risk01: 0, contributions: {}, drivers: {} };

    if (disease === "MAIZE_FAW") res = scoreFAW(agg);
    else if (disease === "MAIZE_LEAF_BLIGHT") res = scoreLeafBlight(agg);

    const { score, level } = classifyRisk(res.risk01);
    const explanation = `Main drivers: ${topDriverText(res.contributions)}`;
    return { score, level, explanation, drivers: res.drivers, meta: window.meta || null };
}

module.exports = { evaluateRiskForMaize };
