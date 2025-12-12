// src/services/weatherIngestService.js
const mongoose = require('mongoose');
const { WeatherDaily } = require("../models/weatherDaily");
const { WeatherForecast } = require("../models/weatherForecast");
const { WeatherForecastNowcast } = require("../models/weatherForecastNowcast");
const { WeatherCurrent } = require("../models/weatherCurrent");
const { Plot } = require("../models/plot");
const { fetchWeatherForLatLon } = require("../helpers/fetchWeather");

/**
 * Ingest Open-Meteo data into:
 * 1. WeatherCurrent (Real-time)
 * 2. WeatherForecastNowcast (Next 24h)
 * 3. WeatherForecast (Next 7 days)
 * 
 * Note: WeatherDaily is NOT updated here to prevent future data from polluting the historical archive.
 * WeatherDaily should be populated by a separate "Archive" job that runs daily for the previous day.
 */
async function ingestWeatherForPlotFromOpenMeteo(plotId, days = 7) {

  // Normalise to a proper ObjectId
  let plotObjectId = plotId;
  if (typeof plotId === "string") {
    if (!mongoose.Types.ObjectId.isValid(plotId)) {
      throw new Error("Invalid plotId string");
    }
    plotObjectId = new mongoose.Types.ObjectId(plotId);
  }

  const plot = await Plot.findById(plotObjectId).lean();
  if (!plot) {
    throw new Error("Plot not found");
  }

  const lat = plot.location?.lat;
  const lng = plot.location?.lng;

  if (lat == null || lng == null) {
    throw new Error("Plot has no location.lat/lng");
  }

  // 1) Call Open-Meteo
  const data = await fetchWeatherForLatLon(lat, lng);

  console.log("Data fetched :",data)

  if (!data.daily || !data.daily.time) {
    throw new Error("Open-Meteo daily data missing");
  }

  // ==========================================
  // A. Ingest Current Weather
  // ==========================================
  if (data.current) {
    await WeatherCurrent.findOneAndUpdate(
      { plot: plotObjectId },
      {
        plot: plotObjectId,
        timestamp: new Date(), // or data.current.time if parsed
        temp: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        condition: String(data.current.weather_code), // Storing code as string
        cloudCover: data.current.cloud_cover,
        pressure: data.current.surface_pressure,
        // uvIndex: not in default current params
      },
      { upsert: true, new: true }
    );
  }

  // ==========================================
  // B. Ingest Nowcast (Next 24 Hours)
  // ==========================================
  if (data.hourly && data.hourly.time) {
    const hourlyTime = data.hourly.time;
    // Limit to next 24 hours
    const maxHours = Math.min(24, hourlyTime.length);

    const hourlyArray = [];
    for (let i = 0; i < maxHours; i++) {
      const timeStr = hourlyTime[i];
      const time = new Date(timeStr + "Z");

      hourlyArray.push({
        time,
        temp: data.hourly.temperature_2m?.[i],
        humidity: data.hourly.relativehumidity_2m?.[i],
        windSpeed: data.hourly.windspeed_10m?.[i],
        precipProbability: data.hourly.precipitation_probability?.[i],
        isDay: !!data.hourly.is_day?.[i],
      });
    }

    if (hourlyArray.length > 0) {
      // Replace the entire document for this plot
      await WeatherForecastNowcast.findOneAndReplace(
        { plot: plotObjectId },
        {
          plot: plotObjectId,
          forecastGeneratedAt: new Date(),
          hourly: hourlyArray
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }

  // ==========================================
  // C. Ingest Daily Forecast (Next 7 Days)
  // ==========================================
  const dailyTime = data.daily.time; // array of "YYYY-MM-DD"
  const maxDays = Math.min(days, dailyTime.length);
  const forecastWrites = [];

  for (let i = 0; i < maxDays; i++) {
    const dateStr = dailyTime[i];
    const date = new Date(dateStr + "T00:00:00.000Z"); // Store as UTC midnight

    forecastWrites.push({
      updateOne: {
        filter: { plot: plotObjectId, date: date },
        update: {
          plot: plotObjectId,
          date: date,
          tMax: data.daily.temperature_2m_max?.[i],
          tMin: data.daily.temperature_2m_min?.[i],
          tMean: data.daily.temperature_2m_mean?.[i],
          rainfallMm: data.daily.precipitation_sum?.[i],
          windSpeedMax: data.daily.windspeed_10m_max?.[i],
          humidityMean: null, // Open-Meteo daily doesn't give mean RH directly easily, or we calc it. Skipping specific aggregates to keep simple as per Model
          forecastGeneratedAt: new Date(),
        },
        upsert: true
      }
    });
  }

  if (forecastWrites.length > 0) {
    await WeatherForecast.bulkWrite(forecastWrites);
  }

  return { plotId, daysIngested: maxDays };
}

/**
 * Archive confirmed daily weather data for a specific past date.
 * Default: yesterday.
 * This is the "Source of Truth" for past weather.
 */
async function syncDailyArchive(plotId, dateStr = null) {
  // 1. Determine date
  let targetDate;
  if (dateStr) {
    targetDate = new Date(dateStr);
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    targetDate = d;
  }
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD

  // 2. Fetch from Open-Meteo with start/end date
  const plot = await Plot.findById(plotId).lean();
  if (!plot) throw new Error("Plot not found");
  const { lat, lng } = plot.location || {};

  // We request specific past days
  const extraParams = {
    start_date: formattedDate,
    end_date: formattedDate,
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "temperature_2m_mean",
      "precipitation_sum",
      "windspeed_10m_max",
      "shortwave_radiation_sum",
      "sunshine_duration",
    ].join(","),
    hourly: "relativehumidity_2m" // needed for RH mean calc
  };

  const data = await fetchWeatherForLatLon(lat, lng, extraParams);

  if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
    console.warn(`No archive data found for ${formattedDate}`);
    return;
  }

  // 3. Process aggregates
  const i = 0; // only 1 day requested
  const hourlyRH = data.hourly?.relativehumidity_2m || [];
  const hoursPerDay = 24;

  // Helper helpers
  const getDailyRhMean = () => {
    if (!hourlyRH.length) return null;
    const sum = hourlyRH.reduce((a, b) => a + b, 0);
    return sum / hourlyRH.length;
  };
  const getRhMorning = () => {
    const slice = hourlyRH.slice(6, 9); // 06:00 - 09:00
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };
  const getRhEvening = () => {
    const slice = hourlyRH.slice(15, 18); // 15:00 - 18:00
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  const rhMean = getDailyRhMean();
  const rainSum = data.daily.precipitation_sum?.[i] ?? 0;

  let leafWetnessHours = 0;
  if (rainSum > 0) leafWetnessHours = 8;
  else if (rhMean >= 90) leafWetnessHours = 6;
  else if (rhMean >= 85) leafWetnessHours = 3;

  // 4. Upsert WeatherDaily
  await WeatherDaily.findOneAndUpdate(
    { plot: plotId, date: new Date(formattedDate + "T00:00:00.000Z") },
    {
      plot: plotId,
      date: new Date(formattedDate + "T00:00:00.000Z"),
      tMax: data.daily.temperature_2m_max?.[i],
      tMin: data.daily.temperature_2m_min?.[i],
      tMean: data.daily.temperature_2m_mean?.[i],
      rhMean,
      rhMorning: getRhMorning() ?? rhMean,
      rhEvening: getRhEvening() ?? rhMean,
      rainfallMm: rainSum,
      windSpeed: data.daily.windspeed_10m_max?.[i],
      solarRadiation: data.daily.shortwave_radiation_sum?.[i],
      sunshineHours: data.daily.sunshine_duration?.[i] ? data.daily.sunshine_duration[i] / 3600 : null,
      leafWetnessHours,
      source: "GRID_API",
      isForecast: false, // Confirmed actual
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { plotId, date: formattedDate, status: "archived" };
}

module.exports = {
  ingestWeatherForPlotFromOpenMeteo,
  syncDailyArchive
};