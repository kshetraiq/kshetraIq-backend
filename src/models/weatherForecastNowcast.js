// src/models/weatherForecastNowcast.js
const mongoose = require("mongoose");

const hourlySchema = new mongoose.Schema(
  {
    time: { type: Date, required: true },

    temperature2m: Number,
    apparentTemperature: Number,
    relativeHumidity2m: Number,
    dewPoint2m: Number,

    precipitationProbability: Number,
    precipitation: Number,
    rain: Number,
    showers: Number,
    snowfall: Number,
    snowDepth: Number,

    vpd: Number,
    weatherCode: Number,

    pressureMSL: Number,
    surfacePressure: Number,

    cloudCover: Number,
    cloudCoverLow: Number,
    cloudCoverMid: Number,
    cloudCoverHigh: Number,

    visibility: Number,

    evapotranspiration: Number,
    et0: Number,

    windSpeed10m: Number,
    windDirection10m: Number,
    windGusts10m: Number,

    soilTemperature0cm: Number,
    soilTemperature6cm: Number,
    soilTemperature18cm: Number,
    soilTemperature54cm: Number,

    soilMoisture0to1cm: Number,
    soilMoisture1to3cm: Number,
    soilMoisture3to9cm: Number,
    soilMoisture9to27cm: Number,
    soilMoisture27to81cm: Number,

    isDay: Boolean,

    // Derived
    leafWetness: Boolean,
    fogFlag: Boolean,
    absoluteHumidity: Number, // g/m³ (derived approx)
  },
  { _id: false }
);

const weatherForecastNowcastSchema = new mongoose.Schema(
  {
    plot: { type: mongoose.Schema.Types.ObjectId, ref: "Plot", required: true, unique: true, index: true },
    forecastGeneratedAt: { type: Date, default: Date.now },

    hourly: { type: [hourlySchema], default: [] },

    // Store raw Open-Meteo response if you want
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const WeatherForecastNowcast = mongoose.model("WeatherForecastNowcast", weatherForecastNowcastSchema);
module.exports = { WeatherForecastNowcast };