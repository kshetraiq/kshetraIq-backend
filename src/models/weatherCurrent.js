const mongoose = require("mongoose");

const weatherCurrentSchema = new mongoose.Schema(
    {
        plot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Plot",
            required: true,
            unique: true, // Only one current weather record per plot
        },
        timestamp: {
            type: Date,
            required: true,
            default: Date.now,
        },

        // Core Parameters
        temp: Number,          // Celsius
        feelsLike: Number,     // Celsius
        humidity: Number,      // %
        windSpeed: Number,     // m/s
        windDirection: Number, // Degrees
        condition: String,     // e.g., "Sunny", "Rain"

        cloudCover: Number,    // %
        pressure: Number,      // hPa
        uvIndex: Number,

        updatedAt: {
            type: Date,
            default: Date.now,
        }
    },
    { timestamps: true }
);

const WeatherCurrent = mongoose.model("WeatherCurrent", weatherCurrentSchema);

module.exports = { WeatherCurrent };
