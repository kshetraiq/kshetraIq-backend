const mongoose = require("mongoose");

const weatherForecastSchema = new mongoose.Schema(
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
        },

        // Daily Forecast Aggregates
        tMax: Number,
        tMin: Number,

        rainChance: Number,     // % Probability
        rainfallMm: Number,     // Predicted amount

        humidityMean: Number,
        windSpeedMax: Number,

        condition: String,      // textual summary
        sunrise: String,
        sunset: String,

        forecastGeneratedAt: {
            type: Date,
            default: Date.now,
        }
    },
    { timestamps: true }
);

// Ensure unique forecast per day per plot
weatherForecastSchema.index({ plot: 1, date: 1 }, { unique: true });

// Auto-expire forecast data after 14 days (just cleanup, strictly we handle overwrite via upsert)
weatherForecastSchema.index({ date: 1 }, { expireAfterSeconds: 1209600 });

const WeatherForecast = mongoose.model("WeatherForecast", weatherForecastSchema);

module.exports = { WeatherForecast };
