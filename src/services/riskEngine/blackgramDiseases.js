const { clamp01, aggregateWeather } = require("./common");

function scorePowderyMildew(agg) {
    const { tMean7, rhM7, rain7 } = agg;
    // Similar to Chilli PM: Warm (20-30), Mod RH
    const tempScore = clamp01(1 - Math.abs(tMean7 - 25) / 7);
    const rhScore = clamp01((rhM7 - 60) / 25);
    const lowRain = clamp01((20 - rain7) / 20);

    const contributions = {
        tempScore: 1.0 * tempScore,
        rhScore: 0.8 * rhScore,
        lowRain: 0.5 * lowRain
    };

    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 1.5)));
    return { risk01, contributions, drivers: { tempScore, rhScore, lowRain } };
}

function scoreLeafSpot(agg) {
    const { rhM7, tMean7, rain7 } = agg;
    // Cercospora: High Humidity, Warm, Rain helps spread
    const rhScore = clamp01((rhM7 - 75) / 15);
    const tempScore = clamp01(1 - Math.abs(tMean7 - 27) / 5);
    const rainScore = clamp01(rain7 / 30);

    const contributions = {
        rhScore: 1.2 * rhScore,
        tempScore: 0.8 * tempScore,
        rainScore: 0.6 * rainScore
    };
    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 1.8)));
    return { risk01, contributions, drivers: { rhScore, tempScore, rainScore } };
}

function scoreYMV(agg) {
    const { tMean7, rain7, rhM7 } = agg;
    // Whitefly vector: Warm (25-30), Humid, but heavy rain washes them away
    const tempScore = clamp01(1 - Math.abs(tMean7 - 28) / 4);
    const rhScore = clamp01((rhM7 - 65) / 20);
    const notHeavyRain = clamp01((50 - rain7) / 50); // <50mm is good for fly, >50mm washes

    const contributions = {
        tempScore: 1.5 * tempScore,
        rhScore: 0.8 * rhScore,
        notHeavyRain: 1.0 * notHeavyRain
    };
    const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
    const risk01 = 1 / (1 + Math.exp(-(raw - 2.2)));
    return { risk01, contributions, drivers: { tempScore, rhScore, notHeavyRain } };
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

function evaluateRiskForBlackGram(disease, window) {
    if (!window || !window.dates || !window.dates.length) return { score: 0, level: "GREEN" };
    const agg = aggregateWeather(window);
    let res = { risk01: 0, contributions: {}, drivers: {} };

    if (disease === "BLACKGRAM_POWDERY_MILDEW") res = scorePowderyMildew(agg);
    else if (disease === "BLACKGRAM_LEAF_SPOT") res = scoreLeafSpot(agg);
    else if (disease === "BLACKGRAM_YMV") res = scoreYMV(agg);

    const { score, level } = classifyRisk(res.risk01);
    const explanation = `Main drivers: ${topDriverText(res.contributions)}`;
    return { score, level, explanation, drivers: res.drivers, meta: window.meta || null };
}

module.exports = { evaluateRiskForBlackGram };
