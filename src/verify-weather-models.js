const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const { Plot } = require("./models/plot");
const { WeatherCurrent } = require("./models/weatherCurrent");
const { WeatherForecastNowcast } = require("./models/weatherForecastNowcast");
const { WeatherForecast } = require("./models/weatherForecast");
const { WeatherDaily } = require("./models/weatherDaily");
const { ingestWeatherForPlotFromOpenMeteo, syncDailyArchive } = require("./services/weatherIngestSerivice");

async function runVerification() {
    console.log("Starting Verification...");
    await connectDB();

    // 1. Find or Create Plot
    let plot = await Plot.findOne();
    if (!plot) {
        console.log("No plot found, creating dummy plot...");
        plot = await Plot.create({
            name: "Test Plot",
            location: { lat: 16.5, lng: 80.5 }, // Amaravati, AP
            area: 10,
            crop: "Paddy"
        });
    }
    console.log(`Using Plot: ${plot._id} at [${plot.location.lat}, ${plot.location.lng}]`);

    // 2. Test Ingestion (Forecasts)
    console.log("\n--- Testing Ingestion ---");
    // Clean up old data to avoid unique index conflicts if switching schemas
    await WeatherForecastNowcast.deleteMany({ plot: plot._id });

    try {
        const result = await ingestWeatherForPlotFromOpenMeteo(plot._id);
        console.log("Ingestion Result:", result);
    } catch (err) {
        console.error("Ingestion Failed:", err);
    }

    // Check Data
    const current = await WeatherCurrent.findOne({ plot: plot._id });
    const nowcastDoc = await WeatherForecastNowcast.findOne({ plot: plot._id });
    const hourlyCount = nowcastDoc?.hourly?.length || 0;
    const dailyForecastCount = await WeatherForecast.countDocuments({ plot: plot._id });

    console.log(`\nVerifying Data:`);
    console.log(`WeatherCurrent: ${current ? "FOUND" : "MISSING"} | Temp: ${current?.temp}°C`);
    console.log(`WeatherForecastNowcast Doc: ${nowcastDoc ? "FOUND" : "MISSING"}`);
    console.log(`WeatherForecastNowcast Hourly Items: ${hourlyCount} (Expected ~24)`);
    console.log(`WeatherForecast Count: ${dailyForecastCount} (Expected ~7)`);

    // 3. Test Archive (Daily)
    console.log("\n--- Testing Archive (Yesterday) ---");
    try {
        const archiveResult = await syncDailyArchive(plot._id);
        console.log("Archive Result:", archiveResult);
    } catch (err) {
        console.error("Archive Failed:", err);
    }

    const dailyCount = await WeatherDaily.countDocuments({ plot: plot._id });
    const dailyRecord = await WeatherDaily.findOne({ plot: plot._id }).sort({ date: -1 });

    console.log(`\nVerifying Archive:`);
    console.log(`WeatherDaily Count: ${dailyCount}`);
    if (dailyRecord) {
        console.log(`Latest Daily Record: ${dailyRecord.date.toISOString().split('T')[0]} | Max Temp: ${dailyRecord.tMax}°C`);
    }

    console.log("\nVerification Complete.");
    process.exit(0);
}

runVerification();
