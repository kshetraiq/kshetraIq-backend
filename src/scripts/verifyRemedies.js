require("dotenv").config({ path: "../../.env" });
const mongoose = require("mongoose");
const { Plot } = require("../models/plot");
const { RiskEvent } = require("../models/riskEvent");
const { evaluateRiskForPlot } = require("../services/riskService");
const { User } = require("../models/user");
const { WeatherForecast } = require("../models/weatherForecast");

const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/agri-guard");
        console.log("MongoDB Connected");
    }
};

const verifyRemedies = async () => {
    await connectDB();

    let user, plot;

    try {
        console.log("🧪 Starting Verification...");

        // 1. Create a dummy user nicely
        user = await User.findOneAndUpdate(
            { phone: "9999999999" },
            { name: "Test User", phone: "9999999999", password: "password123", role: "FARMER" },
            { upsert: true, new: true }
        );

        // 2. Create a dummy plot (RICE)
        plot = await Plot.create({
            farmer: user._id,
            name: "Test Rice Plot",
            district: "Guntur",
            mandal: "Tenali",
            village: "Test Village",
            location: { lat: 16.2, lng: 80.6 },
            crop: "RICE",
            variety: "MTU 1010",
            sowingDate: new Date(),
        });
        console.log("✅ Created Test Plot:", plot._id);

        // 2.5 Seed Mock Weather Data (Forecast)
        console.log("🌦️ Seeding mock forecast data...");
        const today = new Date();
        const dates = [];
        for (let i = 1; i <= 8; i++) { // Next 8 days
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push(d);

            await WeatherForecast.findOneAndUpdate(
                { plot: plot._id, date: d },
                {
                    plot: plot._id,
                    date: d,
                    tMax: 30, tMin: 24, tMean: 27,
                    rhMean: 85, rhMorning: 90, rhEvening: 80, humidityMean: 85,
                    rainfallMm: 5, rainChance: 80,
                    windSpeed: 10, windSpeedMax: 15,
                    solarRadiation: 12, sunshineHours: 4,
                    leafWetnessHours: 12, // High wetness for disease
                    fogFlag: false
                },
                { upsert: true }
            );
        }
        console.log("✅ Seeded weather for", dates.length, "days.");

        // 3. Run Risk Evaluation
        const result = await evaluateRiskForPlot(plot._id, {
            mode: "FORECAST",
            daysWindow: 7,
            autoIngestIfMissing: false
        });

        console.log("Risk Evaluation Result Message:", result.message || "Success");
        console.log("Risks Found:", result.risks?.length);

        if (result.risks && result.risks.length > 0) {
            const risk = await RiskEvent.findById(result.risks[0]._id);
            console.log("First Risk Event Disease:", risk.disease);
            console.log("Has Natural Remedies?", risk.naturalRemedies && risk.naturalRemedies.length > 0);
            console.log("Has Chemical Remedies?", risk.chemicalRemedies && risk.chemicalRemedies.length > 0);

            console.log("Natural Remedies:", risk.naturalRemedies);
            console.log("Chemical Remedies:", risk.chemicalRemedies);

            if (risk.naturalRemedies.length > 0 || risk.chemicalRemedies.length > 0) {
                console.log("✅ SUCCESS: Remedies were attached!");
            } else {
                console.log("⚠️ WARNING: Risk generated but no remedies found. Check database seeding.");
            }
        } else {
            console.log("⚠️ No risks generated. Cannot verify remedy attachment.");
        }

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    } finally {
        if (plot) await Plot.findByIdAndDelete(plot._id);
        if (user) await User.findByIdAndDelete(user._id);
        // mongoose.disconnect();
        process.exit(0);
    }
};

verifyRemedies();
