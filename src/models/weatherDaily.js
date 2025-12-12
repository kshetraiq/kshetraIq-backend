// src/models/weatherDaily.js
const mongoose = require("mongoose");

const weatherDailySchema = new mongoose.Schema(
  {
    plot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plot",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },

    tMax: Number,
    tMin: Number,
    tMean: Number,

    rhMean: Number,
    rhMorning: Number,
    rhEvening: Number,

    rainfallMm: Number,
    windSpeed: Number,

    solarRadiation: Number, // MJ/m²/day
    sunshineHours: Number,

    leafWetnessHours: Number,

    isForecast: {
      type: Boolean,
      default: false,
    },

    source: {
      type: String,
      enum: ["GRID_API", "AWS_STATION", "MANUAL"],
      default: "GRID_API",
    },
  },
  { timestamps: true }
);

weatherDailySchema.index({ plot: 1, date: 1 }, { unique: true });

const WeatherDaily = mongoose.model("WeatherDaily", weatherDailySchema);

module.exports = { WeatherDaily };