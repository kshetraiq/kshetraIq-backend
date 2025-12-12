// src/models/riskEvent.js
const mongoose = require("mongoose");
const { DISEASE_TYPES } = require("./diseaseObservation");

// Include YELLOW + keep HIGH / CRITICAL for backward compatibility if you already have such data
const SEVERITY_VALUES = ["GREEN", "YELLOW", "ORANGE", "RED", "HIGH", "CRITICAL"];

const RISK_SOURCES = [
  "WEATHER_V2",           // generic / old
  "WEATHER_V2_PAST",
  "WEATHER_V2_FORECAST",
  "WEATHER_V2_PROACTIVE",
  "MODEL",
  "MANUAL",
];

const RiskEventSchema = new mongoose.Schema(
  {
    plot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plot",
      required: true,
    },

    disease: {
      type: String,
      enum: DISEASE_TYPES,
      required: true,
    },

    // "Risk for this disease on this date" (usually 'today' as a key date)
    date: {
      type: Date,
      required: true,
    },

    // Now aligned with engine: GREEN / YELLOW / ORANGE / RED (+ legacy)
    severity: {
      type: String,
      enum: SEVERITY_VALUES,
      required: true,
    },

    // 0–100 normalized score
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    horizonDays: {
      type: Number,
      default: 7,
    },

    // Short human-readable explanation from risk engine
    explanation: {
      type: String,
    },

    // Which pipeline produced this?
    // You are already setting source: "WEATHER_V2" / "WEATHER_V2_PROACTIVE" in services
    source: {
      type: String,
      enum: RISK_SOURCES,
      default: "WEATHER_V2",
    },

    // Optional mode flag if you later want to explicitly store PAST / FORECAST / PROACTIVE
    // (not strictly required for current code, but future-proof)
    mode: {
      type: String,
      enum: ["PAST", "FORECAST", "PROACTIVE"],
    },

    // Store driver scores from the engine (tMinRisk, rhMScore, etc.)
    drivers: {
      type: mongoose.Schema.Types.Mixed,
    },

    createdBy: {
      type: String,
      enum: ["RULE_ENGINE", "MODEL", "MANUAL"],
      default: "RULE_ENGINE",
    },
  },
  { timestamps: true }
);

// If you want exactly one record per (plot, disease, date),
// keep this index. It means PROACTIVE will overwrite FORECAST
// for the same day (because filter is { plot, disease, date }).
// If you later want one per mode/source, change the index to include mode/source.
RiskEventSchema.index({ plot: 1, disease: 1, date: 1 }, { unique: true });

const RiskEvent = mongoose.model("RiskEvent", RiskEventSchema);
module.exports = { RiskEvent };