const cron = require("node-cron");
const { Plot } = require("../models/plot");
const { ingestWeatherForPlotFromOpenMeteo, syncDailyArchive } = require("./weatherIngestSerivice");

async function fetchWeatherForAllPlots() {
    console.log("⏳ [CRON] Starting hourly weather fetch for all plots...");
    try {
        const plots = await Plot.find({}).select("_id name"); // minimal select
        console.log(`📊 Found ${plots.length} plots to update.`);

        for (const plot of plots) {
            try {
                await ingestWeatherForPlotFromOpenMeteo(plot._id.toString(), 7); // 7 days forecast
                // console.log(`   ✅ Updated weather for plot: ${plot.name} (${plot._id})`);
            } catch (err) {
                console.error(`   ❌ Failed to update plot ${plot._id}: ${err.message}`);
            }
            // Small delay to be nice to Open-Meteo API (though free tier is high)
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
        console.log("✅ [CRON] Hourly weather update complete.");
    } catch (err) {
        console.error("❌ [CRON] Critical error in fetchWeatherForAllPlots:", err);
    }
}

async function syncDailyArchiveForAllPlots() {
    console.log("⏳ [CRON] Starting daily archive sync (Yesterday's Data)...");
    try {
        const plots = await Plot.find({}).select("_id name");
        console.log(`📊 Found ${plots.length} plots to archive.`);

        // Default behavior of syncDailyArchive is to fetch "yesterday" if no date provided
        for (const plot of plots) {
            try {
                await syncDailyArchive(plot._id.toString());
                // console.log(`   ✅ Archived weather for plot: ${plot.name} (${plot._id})`);
            } catch (err) {
                console.error(`   ❌ Failed to archive plot ${plot._id}: ${err.message}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 500)); // slightly longer delay for archive
        }
        console.log("✅ [CRON] Daily archive sync complete.");
    } catch (err) {
        console.error("❌ [CRON] Critical error in syncDailyArchiveForAllPlots:", err);
    }
}

function initCronJobs() {
    console.log("⏰ Initializing Cron Jobs...");

    // 1. Hourly Forecast Update (Every hour at minute 0)
    // "0 * * * *"
    cron.schedule("0 * * * *", () => {
        fetchWeatherForAllPlots();
    });

    // 2. Daily Archive Sync (Every day at 01:00 AM)
    // "0 1 * * *"
    cron.schedule("0 1 * * *", () => {
        syncDailyArchiveForAllPlots();
    });

    console.log("Note: Weather jobs scheduled (Hourly & Daily 1AM).");
}

module.exports = {
    initCronJobs,
    fetchWeatherForAllPlots,
    syncDailyArchiveForAllPlots
};
