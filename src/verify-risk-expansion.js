const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const { Plot } = require("./models/plot");
const { WeatherForecast } = require("./models/weatherForecast");
const { RiskEvent } = require("./models/riskEvent");
const { evaluateRiskForPlot } = require("./services/riskService");

async function runTest() {
    console.log("🚀 Starting Multi-Crop Risk Verification...");
    await connectDB();

    // 1. Setup Test Plots
    const crops = [
        { name: "Test_Chilli", crop: "CHILLI", district: "Guntur" },
        { name: "Test_BlackGram", crop: "BLACKGRAM", district: "Krishna" },
        { name: "Test_Maize", crop: "MAIZE", district: "Kurnool" },
    ];

    const plotIds = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Clean up previous test data
    await RiskEvent.deleteMany({ source: "TEST_VERIFY" });

    for (const c of crops) {
        // Upsert plot
        let plot = await Plot.findOne({ name: c.name });
        if (!plot) {
            plot = await Plot.create({
                name: c.name,
                crop: c.crop,
                district: c.district,
                mandala: "TestMandal",
                village: "TestVillage",
                location: { lat: 16.0, lng: 80.0 }, // Dummy
                farmer: new mongoose.Types.ObjectId(), // Fake farmer ID
                areaAcres: 2
            });
        }
        // ensure crop is set correctly if it existed
        plot.crop = c.crop;
        await plot.save();
        plotIds.push(plot);

        // Clear old forecast for this plot to ensure clean slate
        await WeatherForecast.deleteMany({ plot: plot._id });

        // 2. Insert Mock Weather Data (Next 7 days)
        // Create conditions favorable for diseases
        const entries = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(startOfToday);
            d.setDate(d.getDate() + i);

            let weather = {};

            if (c.crop === "CHILLI") {
                // High Risk for Anthracnose (High Rain + Humid)
                weather = { tMean: 27, tMax: 30, tMin: 24, rhMean: 85, rhMorning: 90, rhEvening: 80, rainfallMm: 10, leafWetnessHours: 12 };
            } else if (c.crop === "BLACKGRAM") {
                // High Risk for PM (Warm, Mod RH, Low Rain)
                weather = { tMean: 25, tMax: 29, tMin: 21, rhMean: 70, rhMorning: 75, rhEvening: 65, rainfallMm: 0, leafWetnessHours: 4 };
            } else if (c.crop === "MAIZE") {
                // High Risk for FAW (Warm, No Rain)
                weather = { tMean: 28, tMax: 32, tMin: 24, rhMean: 60, rhMorning: 70, rhEvening: 50, rainfallMm: 0, leafWetnessHours: 2 };
            }

            entries.push({
                plot: plot._id,
                date: d,
                ...weather,
                forecastGeneratedAt: new Date()
            });
        }
        await WeatherForecast.insertMany(entries);
    }

    // 3. Run Evaluation
    console.log("\n📊 Evaluating Risks...");
    for (const plot of plotIds) {
        // mode: FORECAST, autoIngest: false (we just inserted data)
        const res = await evaluateRiskForPlot(plot._id, { mode: "FORECAST", autoIngestIfMissing: false });

        console.log(`\nResults for [${plot.crop}]: ${res.risks.length} risks found`);
        res.risks.forEach(r => {
            console.log(` - ${r.disease}: ${r.severity} (${r.score})`);
            console.log(`   Explanation: ${r.explanation}`);
        });
    }

    console.log("\n✅ Verification Complete.");
    process.exit(0);
}

runTest().catch(console.error);
