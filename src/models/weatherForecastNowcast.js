const mongoose = require("mongoose");

const weatherForecastNowcastSchema = new mongoose.Schema(
    {
        plot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Plot",
            required: true,
            unique: true, // Single document per plot
            index: true,
        },

        forecastGeneratedAt: {
            type: Date,
            default: Date.now,
        },

        // Array of hourly data
        hourly: [
            {
                time: { type: Date, required: true },
                temp: Number,
                humidity: Number,
                windSpeed: Number,
                precipProbability: Number,
                condition: String,
                isDay: Boolean,
            }
        ]
    },
    { timestamps: true }
);

const WeatherForecastNowcast = mongoose.model("WeatherForecastNowcast", weatherForecastNowcastSchema);

module.exports = { WeatherForecastNowcast };
