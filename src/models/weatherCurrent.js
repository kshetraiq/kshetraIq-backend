// src/models/weatherCurrent.js
const mongoose = require("mongoose");

const weatherCurrentSchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: "Plot", required: true, unique: true, index: true },

    // From API (unixtime -> Date)
    timestamp: { type: Date, required: true, default: Date.now },

    // Core crop monitoring fields
    temp: Number,
    feelsLike: Number,
    humidity: Number,
    dewPoint: Number,

    windSpeed: Number,
    windDirection: Number,
    windGusts: Number,

    precipitation: Number,
    rain: Number,
    showers: Number,
    snowfall: Number,

    cloudCover: Number,
    visibility: Number,

    surfacePressure: Number,
    pressureMSL: Number,

    vpd: Number,          // vapour_pressure_deficit
    et0: Number,          // et0_fao_evapotranspiration
    conditionCode: Number, // weather_code
    isDay: Boolean,

    // Derived helpers
    fogFlag: Boolean,
    panEvaporation: Number, // ~0.8*ET0 (approx)

    // Store everything (so nothing is lost)
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const WeatherCurrent = mongoose.model("WeatherCurrent", weatherCurrentSchema);
module.exports = { WeatherCurrent };