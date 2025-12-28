const { clamp01, aggregateWeather } = require("./common");

function scoreAnthracnose(agg) {
    const { rain7, rhM7, tMean7, lw7 } = agg;

    // High Rainfall (>20mm), High Humidity (>80%), Temp 24-30, LW > 10h
    const rainScore = clamp01(rain7 / 20);
    const rhScore = clamp01((rhM7 - 75) / 15);
    const tempScore = clamp01(1 - Math.abs(tMean7 - 27) / 5); // Peak at 27, drop off by 22/32
    const lwScore = clamp01(lw7 / 10);

    const contributions = {
        rainScore: 0.8 * rainScore,
        rhScore: 1.0 * rhScore,
        tempScore: 0.7 * tempScore,
        lwScore: 0.5 * lwScore,
    };

    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 2.0))); // thresholds need tuning

    return { risk01, contributions, drivers: { rainScore, rhScore, tempScore, lwScore } };
}

function scorePowderyMildew(agg) {
    const { tMax7, tMin7, rhM7, rain7 } = agg;

    // Warm days (20-35), cool nights, RH 60-80 (not saturated), Low Rain
    const tMaxScore = clamp01(1 - Math.abs(tMax7 - 28) / 8); // Peak 28
    const tMinScore = clamp01((20 - tMin7) / 10); // Cooler nights better for spore formation? (Ref check: warm humid days, cool nights)
    const rhScore = clamp01((rhM7 - 60) / 20) * clamp01((95 - rhM7) / 10); // Penalty if too wet (>95)
    const dryScore = clamp01((10 - rain7) / 10); // Drier is better for dispersion

    const contributions = {
        tMaxScore: 0.8 * tMaxScore,
        tMinScore: 0.6 * tMinScore,
        rhScore: 1.0 * rhScore,
        dryScore: 0.7 * dryScore,
    };

    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 2.0)));

    return { risk01, contributions, drivers: { tMaxScore, tMinScore, rhScore, dryScore } };
}

function scoreThrips(agg) {
    const { tMax7, rain7 } = agg;

    // Dry weather + Warm (>25)
    const tempScore = clamp01((tMax7 - 25) / 10);
    const dryScore = clamp01((5 - rain7) / 5); // Zero rain is best for thrips

    const contributions = {
        tempScore: 1.2 * tempScore,
        dryScore: 1.5 * dryScore,
    };

    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 1.8)));

    return { risk01, contributions, drivers: { tempScore, dryScore } };
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

function evaluateRiskForChilli(disease, window) {
    if (!window || !window.dates || !window.dates.length) return { score: 0, level: "GREEN" };

    const agg = aggregateWeather(window);
    let res = { risk01: 0, contributions: {}, drivers: {} };

    if (disease === "CHILLI_ANTHRACNOSE") res = scoreAnthracnose(agg);
    else if (disease === "CHILLI_POWDERY_MILDEW") res = scorePowderyMildew(agg);
    else if (disease === "CHILLI_THRIPS") res = scoreThrips(agg);

    const { score, level } = classifyRisk(res.risk01);
    const explanation = `Main drivers: ${topDriverText(res.contributions)}`;

    return { score, level, explanation, drivers: res.drivers, meta: window.meta || null };
}

module.exports = { evaluateRiskForChilli };
