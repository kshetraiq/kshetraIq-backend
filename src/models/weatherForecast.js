// src/models/weatherForecast.js
const mongoose = require("mongoose");

const weatherForecastSchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: "Plot", required: true, index: true },
    date: { type: Date, required: true },

    // Temperature
    tMax: Number,
    tMin: Number,
    tMean: Number,
    apparentMax: Number,
    apparentMin: Number,

    // Humidity (daily mean not always provided; we keep slot)
    humidityMean: Number,

    // Rain
    rainfallMm: Number,          // precipitation_sum fallback rain_sum
    rainSum: Number,
    showersSum: Number,
    snowfallSum: Number,
    precipitationSum: Number,
    precipitationHours: Number,
    rainChance: Number,          // precipitation_probability_max

    // Wind
    windSpeedMax: Number,
    windGustsMax: Number,
    windDirectionDominant: Number,

    // Radiation/Sun
    solarRadiation: Number,      // shortwave_radiation_sum
    sunshineDurationSec: Number,
    sunshineHours: Number,
    uvIndexMax: Number,
    uvIndexClearSkyMax: Number,
    sunrise: Date,
    sunset: Date,
    daylightDurationSec: Number,
    dayLengthHours: Number,

    // Others
    pressure: Number,
    cloudCover: Number,
    fogFlag: Boolean,

    // Derived crop helpers
    leafWetnessHours: Number,
    gddDaily: Number, // base 10°C default

    // Weather code
    weatherCode: Number,

    forecastGeneratedAt: { type: Date, default: Date.now },

    // Store everything
    allParams: { type: mongoose.Schema.Types.Mixed, default: {} },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

weatherForecastSchema.index({ plot: 1, date: 1 }, { unique: true });
weatherForecastSchema.index({ date: 1 }, { expireAfterSeconds: 1209600 }); // 14 days cleanup

const WeatherForecast = mongoose.model("WeatherForecast", weatherForecastSchema);
module.exports = { WeatherForecast };