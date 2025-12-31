const mongoose = require("mongoose");

const DailyMetricSchema = new mongoose.Schema({
    dateYMD: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    mode: { type: String, required: true },
    daysWindow: { type: Number, required: true },
    totalPlots: { type: Number, required: true },
    updatedPlots: { type: Number, required: true },
    errors: { type: Number, default: 0 },
    details: { type: mongoose.Schema.Types.Mixed }, // optional extra info
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("DailyMetric", DailyMetricSchema);