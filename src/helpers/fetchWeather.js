// src/helpers/fetchWeather.js
const axios = require("axios");

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

// Full parameter set (only include params you are confident Open-Meteo supports)
const FULL_DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "shortwave_radiation_sum",
  "et0_fao_evapotranspiration",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
  "uv_index_max",
  "uv_index_clear_sky_max",
  "rain_sum",
  "showers_sum",
  "snowfall_sum",
  "precipitation_sum",
  "precipitation_hours",
  "precipitation_probability_max",
];

const FULL_HOURLY = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",

  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "snow_depth",

  "vapour_pressure_deficit",
  "weather_code",

  "pressure_msl",
  "surface_pressure",

  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",

  "evapotranspiration",
  "et0_fao_evapotranspiration",

  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",

  "soil_temperature_0cm",
  "soil_temperature_6cm",
  "soil_temperature_18cm",
  "soil_temperature_54cm",

  "soil_moisture_0_to_1cm",
  "soil_moisture_1_to_3cm",
  "soil_moisture_3_to_9cm",
  "soil_moisture_9_to_27cm",
  "soil_moisture_27_to_81cm",

  "is_day",
];

const FULL_CURRENT = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",
  "is_day",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "surface_pressure",
  "pressure_msl",
  "cloud_cover",
  "weather_code",
  "visibility",
  "vapour_pressure_deficit",
  "et0_fao_evapotranspiration",
];

function joinIfArray(v) {
  return Array.isArray(v) ? v.join(",") : v;
}

function sanitizeParams(params) {
  const out = { ...params };

  // If date range exists => must use ARCHIVE API and remove past/forecast_days
  const hasRange = !!out.start_date || !!out.end_date;
  if (hasRange) {
    delete out.past_days;
    delete out.forecast_days;
  }

  // join arrays
  out.daily = joinIfArray(out.daily);
  out.hourly = joinIfArray(out.hourly);
  out.current = joinIfArray(out.current);

  // remove undefined/null
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined || out[k] === null) delete out[k];
  });

  return out;
}

async function fetchWeatherForLatLon(lat, lon, extraParams = {}) {
  const params = sanitizeParams({
    latitude: lat,
    longitude: lon,

    // IMPORTANT: unixtime makes time parsing correct always
    timeformat: "unixtime",
    timezone: extraParams.timezone || "Asia/Kolkata",

    // defaults (can be overridden)
    forecast_days: 10,
    past_days: 7,

    daily: FULL_DAILY,
    hourly: FULL_HOURLY,
    current: FULL_CURRENT,

    ...extraParams,
  });

  console.log("Fetching weather for lat/lon:", lat, lon);
  console.log("Params:", params);

  const hasRange = !!params.start_date || !!params.end_date;
  const url = hasRange ? ARCHIVE_URL : FORECAST_URL;

  const res = await axios.get(url, { params });
  return res.data;
}

module.exports = {
  fetchWeatherForLatLon,
  FULL_DAILY,
  FULL_HOURLY,
  FULL_CURRENT,
};