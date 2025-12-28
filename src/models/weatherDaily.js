// src/models/weatherDaily.js
const mongoose = require("mongoose");

const extremeSchema = new mongoose.Schema(
  {
    heatwave: Boolean,
    frost: Boolean,
    heavyRain: Boolean,
    highWind: Boolean,
    thunderstorm: Boolean,
  },
  { _id: false }
);

const weatherDailySchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: "Plot", required: true, index: true },
    date: { type: Date, required: true, index: true },

    // Temperature
    tMax: Number,
    tMin: Number,
    tMean: Number,

    // RH slices
    rhMean: Number,
    rhMorning: Number,
    rhEvening: Number,

    // Rain/Wind
    rainfallMm: Number,
    windSpeed: Number,
    windDirectionDominant: Number,
    windGustsMax: Number,

    // Radiation/Sun
    solarRadiation: Number,
    sunshineHours: Number,
    sunshineDurationSec: Number,
    sunrise: Date,
    sunset: Date,
    daylightDurationSec: Number,
    dayLengthHours: Number,

    // Moisture indicators
    leafWetnessHours: Number,
    dewPointMean: Number,
    vpdMean: Number,

    // Water demand
    et0: Number,
    evapotranspirationSum: Number,
    panEvaporation: Number,

    // Soil
    soilTemperature0cmMean: Number,
    soilMoisture0to10cmMean: Number,

    // Atmosphere
    pressureMean: Number,
    cloudCoverMean: Number,
    visibilityMean: Number,
    fogFlag: Boolean,

    // Crop helpers
    gddDaily: Number,
    absoluteHumidityMean: Number,

    // Extreme flags
    extremes: { type: extremeSchema, default: {} },

    isForecast: { type: Boolean, default: false },

    source: {
      type: String,
      enum: ["OPEN_METEO", "GRID_API", "AWS_STATION", "MANUAL"],
      default: "OPEN_METEO",
    },

    // Store everything for audit & future model improvements
    allParams: { type: mongoose.Schema.Types.Mixed, default: {} },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

weatherDailySchema.index({ plot: 1, date: 1 }, { unique: true });

const WeatherDaily = mongoose.model("WeatherDaily", weatherDailySchema);
module.exports = { WeatherDaily };