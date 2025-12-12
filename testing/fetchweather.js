// src/services/weatherFetcher.js
const axios = require("axios");

/**
 * Fetch rich weather data for a given latitude & longitude
 * using the free Open-Meteo API (no API key required).
 *
 * It returns:
 *  - hourly: temperature, humidity, wind, rain
 *  - daily: max/min temp, rain, wind, solar radiation, sunshine
 *
 * @param {number} lat  - latitude (e.g. 16.086)
 * @param {number} lon  - longitude (e.g. 80.169)
 */
async function fetchWeatherForLatLon(lat, lon) {
  // You can tune which variables you want in hourly/daily
  const params = {
    latitude: lat,
    longitude: lon,
    // hourly variables
    hourly: [
      "temperature_2m",
      "relativehumidity_2m",
      "dewpoint_2m",
      "rain",
      "surface_pressure",
      "windspeed_10m",
      "winddirection_10m",
      "shortwave_radiation",
    ].join(","),
    // daily aggregates
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "temperature_2m_mean",
      "precipitation_sum",
      "windspeed_10m_max",
      "shortwave_radiation_sum",
      "sunshine_duration",
    ].join(","),
    timezone: "auto",
  };

  const url = "https://api.open-meteo.com/v1/forecast";

  try {
    const response = await axios.get(url, { params });

    // Raw Open-Meteo response (you can map it into WeatherDaily later)
    return response.data;
  } catch (err) {
    console.error("❌ Error fetching weather:", err.message);
    throw new Error("Failed to fetch weather data");
  }
}

module.exports = { fetchWeatherForLatLon };