const {
    fetchWeatherForAllPlots,
    syncDailyArchiveForAllPlots,
} = require("../services/cronService");

const { evaluateRiskForAllPlots } = require("../services/riskService");
const dailyMetricModel = require("../models/dailyMetricSchema");

// Simple security check helper
const checkSecret = (req) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true; // Warn: If no secret set, allow? Better to deny or warn.
    // We should enforce secret if it is set. If not set, maybe deny for safety in prod?
    // For now let's check query param or header
    const provided = req.query.key || req.headers["x-cron-secret"];
    return provided === secret;
};

exports.triggerWeatherUpdate = async (req, res, next) => {
    try {
        if (!checkSecret(req)) {
            return res.status(403).json({ error: "Unauthorized: Invalid CRON_SECRET" });
        }

        // Run in background? Or wait? 
        // Usually cron triggers expect a quick response. 
        // We can await it if acceptable, or fire and forget. 
        // Given usage limits, awaiting is safer to prevent overlap if caller retries.
        console.log("🚀 Manual trigger: fetchWeatherForAllPlots");
        await fetchWeatherForAllPlots();

        res.json({ message: "Weather update triggered successfully" });
    } catch (error) {
        next(error);
    }
};

exports.triggerDailyArchive = async (req, res, next) => {
    try {
        if (!checkSecret(req)) {
            return res.status(403).json({ error: "Unauthorized: Invalid CRON_SECRET" });
        }

        console.log("🚀 Manual trigger: syncDailyArchiveForAllPlots");
        await syncDailyArchiveForAllPlots();

        res.json({ message: "Daily archive sync triggered successfully" });
    } catch (error) {
        next(error);
    }
};

exports.triggerRiskRecompute = async (req, res, next) => {
    try {
        if (!checkSecret(req)) {
            return res.status(403).json({ error: "Unauthorized: Invalid CRON_SECRET" });
        }

        // Fire-and-Forget
        console.log("🚀 Manual trigger: evaluateRiskForAllPlots (Background)");

        // Default params
        const daysWindow = req.query.daysWindow ? parseInt(req.query.daysWindow) : 7;
        const mode = req.query.mode || "FORECAST";

        // Start background process and save daily metric on completion
        evaluateRiskForAllPlots({ daysWindow, mode })
            .then(async (results) => {
                try {
                    const totalPlots = Array.isArray(results) ? results.length : 0;
                    const updatedPlots = Array.isArray(results) ? results.filter(r => !r.error).length : 0;
                    const errors = Array.isArray(results) ? results.filter(r => r.error).length : 0;

                    await dailyMetricModel.create({
                        dateYMD: new Date().toISOString().slice(0, 10),
                        mode,
                        daysWindow,
                        totalPlots,
                        updatedPlots,
                        errors,
                    });

                    ("✅ Background Risk Recompute Completed - metric saved");
                } catch (e) {
                    console.error("❌ Failed to save daily metric:", e);
                }
            })
            .catch(err => console.error("❌ Background Risk Recompute Failed:", err));


        res.status(202).json({
            message: "Risk recompute started in background",
            details: { mode, daysWindow, batchSize: 50, note: "Check server logs for progress" }
        });
    } catch (error) {
        next(error);
    }
};

exports.getJobHistory = async (req, res, next) => {
    try {
        if (!checkSecret(req)) {
            return res.status(403).json({ error: "Unauthorized: Invalid CRON_SECRET" });
        }

        const history = await dailyMetricModel.find({})
            .sort({ dateYMD: -1, createdAt: -1 })
            .limit(30)
            .lean();

        res.json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
};
