const mongoose = require("mongoose");
const { Plot } = require("../models/plot");
const { WeatherDaily } = require("../models/weatherDaily");
const { WeatherForecast } = require("../models/weatherForecast");
const { WeatherForecastNowcast } = require("../models/weatherForecastNowcast");
const { WeatherCurrent } = require("../models/weatherCurrent");
const { fetchWeatherForLatLon } = require("../helpers/fetchWeather");

/* ------------------------- utilities ------------------------- */

function getUtcOffsetSeconds(data) {
  const v = data?.utc_offset_seconds;
  return typeof v === "number" ? v : 0;
}

// Open-Meteo with timeformat=unixtime returns timestamps in GMT+0,
// so we apply utc_offset_seconds again to get correct local timestamps.
function toDateFromUnixWithOffset(sec, offsetSeconds) {
  if (typeof sec !== "number") return null;
  return new Date((sec + offsetSeconds) * 1000);
}

function mean(arr) {
  if (!arr || !arr.length) return null;
  const nums = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sliceHours(arr, start, endExclusive) {
  if (!arr || !arr.length) return [];
  return arr.slice(start, endExclusive).filter((v) => typeof v === "number" && Number.isFinite(v));
}

// absolute humidity (g/m³) approximate
function calcAbsoluteHumidity(tempC, rh) {
  if (tempC == null || rh == null) return null;
  const es = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
  const e = (rh / 100) * es;
  return 216.7 * (e / (tempC + 273.15));
}

function calcLeafWetnessHoursFromHourly(hourly) {
  const rh = hourly?.relative_humidity_2m || [];
  const rain = hourly?.rain || [];
  const precip = hourly?.precipitation || [];
  const len = Math.max(rh.length, rain.length, precip.length);
  let hours = 0;
  for (let i = 0; i < len; i++) {
    const r = typeof rh[i] === "number" ? rh[i] : 0;
    const ra = typeof rain[i] === "number" ? rain[i] : 0;
    const pr = typeof precip[i] === "number" ? precip[i] : 0;
    if (r >= 80 || ra > 0 || pr > 0) hours++;
  }
  return hours;
}

function calcFogFlag(rhMean, visibilityMean) {
  if (rhMean == null || visibilityMean == null) return null;
  return rhMean >= 95 && visibilityMean <= 1000;
}

function calcGddDaily(tMax, tMin, tBase = 10) {
  if (tMax == null || tMin == null) return null;
  const tMean = (tMax + tMin) / 2;
  return Math.max(tMean - tBase, 0);
}

function extremeFlags(tMax, tMin, rainMm, windMax, code) {
  return {
    hail: false, // keep for future rule/source
    heatwave: typeof tMax === "number" ? tMax > 35 : false,
    frost: typeof tMin === "number" ? tMin < 0 : false,
    heavyRain: typeof rainMm === "number" ? rainMm > 50 : false,
    highWind: typeof windMax === "number" ? windMax > 40 : false,
    thunderstorm: typeof code === "number" ? code >= 95 : false,
  };
}

function formatDateInTZ(dateObj, timeZone) {
  // returns YYYY-MM-DD in a target TZ using Intl (no external libs)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateObj);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/* ------------------------------------------------------------------ */
/**
 * Ingest Open-Meteo forecast into:
 * 1) WeatherCurrent
 * 2) WeatherForecastNowcast (NEXT 24 HOURS from current time)
 * 3) WeatherForecast (NEXT N DAYS from today)
 */
async function ingestWeatherForPlotFromOpenMeteo(plotId, days = 7, options = {}) {
  let plotObjectId = plotId;
  if (typeof plotId === "string") {
    if (!mongoose.Types.ObjectId.isValid(plotId)) throw new Error("Invalid plotId string");
    plotObjectId = new mongoose.Types.ObjectId(plotId);
  }

  const plot = await Plot.findById(plotObjectId).lean();
  if (!plot) throw new Error("Plot not found");

  const lat = plot.location?.lat;
  const lng = plot.location?.lng;
  if (lat == null || lng == null) throw new Error("Plot has no location.lat/lng");

  const tz = options.timezone || "Asia/Kolkata";

  // Forecast API call (no start/end)
  const data = await fetchWeatherForLatLon(lat, lng, {
    timezone: tz,
    forecast_days: Math.max(days, 7),
    past_days: 7, // keep for “daily archive-like” calculations if you want, but we’ll slice properly
  });

  const offset = getUtcOffsetSeconds(data);

  // current time epoch in the API response (GMT+0 style), we’ll convert using offset when needed
  const currentTimeSec = typeof data?.current?.time === "number" ? data.current.time : null;

  /* ---------------------- A) WeatherCurrent ---------------------- */
  if (data?.current) {
    const ts = toDateFromUnixWithOffset(data.current.time, offset) || new Date();

    const rh = data.current.relative_humidity_2m;
    const vis = data.current.visibility;

    const allParams = { ...data.current };

    const currentDoc = {
      plot: plotObjectId,
      timestamp: ts,

      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: rh,
      dewPoint: data.current.dew_point_2m,

      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      windGusts: data.current.wind_gusts_10m,

      precipitation: data.current.precipitation,
      rain: data.current.rain,
      showers: data.current.showers,
      snowfall: data.current.snowfall,

      cloudCover: data.current.cloud_cover,
      visibility: vis,

      surfacePressure: data.current.surface_pressure,
      pressureMSL: data.current.pressure_msl,

      vpd: data.current.vapour_pressure_deficit,
      et0: data.current.et0_fao_evapotranspiration,

      isDay: !!data.current.is_day,
      conditionCode: data.current.weather_code,

      fogFlag: calcFogFlag(rh, vis),

      panEvaporation:
        typeof data.current.et0_fao_evapotranspiration === "number"
          ? data.current.et0_fao_evapotranspiration * 0.8
          : null,

      allParams,
      raw: options.saveRaw ? data.current : {},
    };

    await WeatherCurrent.findOneAndUpdate({ plot: plotObjectId }, currentDoc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  /* ------------------ B) WeatherForecastNowcast ------------------ */
  if (data?.hourly?.time && Array.isArray(data.hourly.time) && data.hourly.time.length) {
    // FIX: past_days adds old hours at the beginning, so we start from “now”
    let startIdx = 0;
    if (typeof currentTimeSec === "number") {
      startIdx = data.hourly.time.findIndex((t) => typeof t === "number" && t >= currentTimeSec);
      if (startIdx < 0) startIdx = 0;
    }

    const maxHours = Math.min(24, data.hourly.time.length - startIdx);
    const hourlyDocs = [];

    for (let i = 0; i < maxHours; i++) {
      const idx = startIdx + i;

      const time = toDateFromUnixWithOffset(data.hourly.time[idx], offset);
      const rh = data.hourly.relative_humidity_2m?.[idx];
      const vis = data.hourly.visibility?.[idx];
      const temp = data.hourly.temperature_2m?.[idx];

      const leafWetness =
        (typeof rh === "number" && rh >= 80) ||
        (typeof data.hourly.rain?.[idx] === "number" && data.hourly.rain[idx] > 0) ||
        (typeof data.hourly.precipitation?.[idx] === "number" && data.hourly.precipitation[idx] > 0);

      hourlyDocs.push({
        time,

        temperature2m: temp,
        apparentTemperature: data.hourly.apparent_temperature?.[idx],
        relativeHumidity2m: rh,
        dewPoint2m: data.hourly.dew_point_2m?.[idx],

        precipitationProbability: data.hourly.precipitation_probability?.[idx],
        precipitation: data.hourly.precipitation?.[idx],
        rain: data.hourly.rain?.[idx],
        showers: data.hourly.showers?.[idx],
        snowfall: data.hourly.snowfall?.[idx],
        snowDepth: data.hourly.snow_depth?.[idx],

        vpd: data.hourly.vapour_pressure_deficit?.[idx],
        weatherCode: data.hourly.weather_code?.[idx],

        pressureMSL: data.hourly.pressure_msl?.[idx],
        surfacePressure: data.hourly.surface_pressure?.[idx],

        cloudCover: data.hourly.cloud_cover?.[idx],
        cloudCoverLow: data.hourly.cloud_cover_low?.[idx],
        cloudCoverMid: data.hourly.cloud_cover_mid?.[idx],
        cloudCoverHigh: data.hourly.cloud_cover_high?.[idx],

        visibility: vis,

        evapotranspiration: data.hourly.evapotranspiration?.[idx],
        et0: data.hourly.et0_fao_evapotranspiration?.[idx],

        windSpeed10m: data.hourly.wind_speed_10m?.[idx],
        windDirection10m: data.hourly.wind_direction_10m?.[idx],
        windGusts10m: data.hourly.wind_gusts_10m?.[idx],

        soilTemperature0cm: data.hourly.soil_temperature_0cm?.[idx],
        soilTemperature6cm: data.hourly.soil_temperature_6cm?.[idx],
        soilTemperature18cm: data.hourly.soil_temperature_18cm?.[idx],
        soilTemperature54cm: data.hourly.soil_temperature_54cm?.[idx],

        soilMoisture0to1cm: data.hourly.soil_moisture_0_to_1cm?.[idx],
        soilMoisture1to3cm: data.hourly.soil_moisture_1_to_3cm?.[idx],
        soilMoisture3to9cm: data.hourly.soil_moisture_3_to_9cm?.[idx],
        soilMoisture9to27cm: data.hourly.soil_moisture_9_to_27cm?.[idx],
        soilMoisture27to81cm: data.hourly.soil_moisture_27_to_81cm?.[idx],

        isDay: !!data.hourly.is_day?.[idx],

        leafWetness,
        fogFlag: calcFogFlag(rh, vis),
        absoluteHumidity: calcAbsoluteHumidity(temp, rh),
      });
    }

    await WeatherForecastNowcast.findOneAndReplace(
      { plot: plotObjectId },
      {
        plot: plotObjectId,
        forecastGeneratedAt: new Date(),
        hourly: hourlyDocs,
        raw: options.saveRaw ? data : {},
      },
      { upsert: true }
    );
  }

  /* --------------------- C) WeatherForecast (daily) --------------------- */
  if (data?.daily?.time && Array.isArray(data.daily.time) && data.daily.time.length) {
    // FIX: past_days adds old days at the beginning, so start from “today”
    let dayStartIdx = 0;
    if (typeof currentTimeSec === "number") {
      const localNow = currentTimeSec + offset;
      const startOfTodayLocal = localNow - (localNow % 86400);

      dayStartIdx = data.daily.time.findIndex((t) => {
        if (typeof t !== "number") return false;
        const localT = t + offset;
        return localT >= startOfTodayLocal;
      });
      if (dayStartIdx < 0) dayStartIdx = 0;
    }

    const maxDays = Math.min(days, data.daily.time.length - dayStartIdx);
    const writes = [];

    for (let i = 0; i < maxDays; i++) {
      const idx = dayStartIdx + i;
      const date = toDateFromUnixWithOffset(data.daily.time[idx], offset);

      const tMax = data.daily.temperature_2m_max?.[idx];
      const tMin = data.daily.temperature_2m_min?.[idx];
      const tMean = data.daily.temperature_2m_mean?.[idx] ?? (tMax != null && tMin != null ? (tMax + tMin) / 2 : null);

      const precipitationSum = data.daily.precipitation_sum?.[idx];
      const rainSum = data.daily.rain_sum?.[idx];
      const rainfallMm = precipitationSum ?? rainSum ?? 0;

      const sunshineDurationSec = data.daily.sunshine_duration?.[idx];
      const sunshineHours = typeof sunshineDurationSec === "number" ? sunshineDurationSec / 3600 : null;

      const daylightDurationSec = data.daily.daylight_duration?.[idx];
      const dayLengthHours = typeof daylightDurationSec === "number" ? daylightDurationSec / 3600 : null;

      const gddBase = options.gddBase ?? 10;
      const gddDaily = calcGddDaily(tMax, tMin, gddBase);

      const allParams = {};
      Object.keys(data.daily).forEach((k) => {
        if (k === "time") return;
        allParams[k] = Array.isArray(data.daily[k]) ? data.daily[k][idx] : null;
      });

      writes.push({
        updateOne: {
          filter: { plot: plotObjectId, date },
          update: {
            plot: plotObjectId,
            date,

            tMax,
            tMin,
            tMean,
            apparentMax: data.daily.apparent_temperature_max?.[idx],
            apparentMin: data.daily.apparent_temperature_min?.[idx],

            rainChance: data.daily.precipitation_probability_max?.[idx],
            rainfallMm,
            rainSum: data.daily.rain_sum?.[idx],
            showersSum: data.daily.showers_sum?.[idx],
            snowfallSum: data.daily.snowfall_sum?.[idx],
            precipitationSum: data.daily.precipitation_sum?.[idx],
            precipitationHours: data.daily.precipitation_hours?.[idx],

            windSpeedMax: data.daily.wind_speed_10m_max?.[idx],
            windGustsMax: data.daily.wind_gusts_10m_max?.[idx],
            windDirectionDominant: data.daily.wind_direction_10m_dominant?.[idx],

            solarRadiation: data.daily.shortwave_radiation_sum?.[idx],
            sunshineDurationSec,
            sunshineHours,

            sunrise: toDateFromUnixWithOffset(data.daily.sunrise?.[idx], offset),
            sunset: toDateFromUnixWithOffset(data.daily.sunset?.[idx], offset),
            daylightDurationSec,
            dayLengthHours,

            uvIndexMax: data.daily.uv_index_max?.[idx],
            uvIndexClearSkyMax: data.daily.uv_index_clear_sky_max?.[idx],

            weatherCode: data.daily.weather_code?.[idx],

            gddDaily,
            gddBase,

            allParams,
            raw: options.saveRaw ? data.daily : {},

            forecastGeneratedAt: new Date(),
          },
          upsert: true,
        },
      });
    }

    if (writes.length) await WeatherForecast.bulkWrite(writes);
  }

  return { plotId: String(plotObjectId), daysIngested: days };
}

/* ------------------------------------------------------------------ */
/**
 * Archive confirmed daily weather for a date (default: yesterday in TZ)
 * Uses Archive API automatically because start_date/end_date are set.
 */
async function syncDailyArchive(plotId, dateStr = null, options = {}) {
  const tz = options.timezone || "Asia/Kolkata";

  let target = dateStr;
  if (!target) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    target = formatDateInTZ(yesterday, tz);
  }

  const plot = await Plot.findById(plotId).lean();
  if (!plot) throw new Error("Plot not found");

  const { lat, lng } = plot.location || {};
  if (lat == null || lng == null) throw new Error("Plot has no location.lat/lng");

  const data = await fetchWeatherForLatLon(lat, lng, {
    timezone: tz,
    start_date: target,
    end_date: target,
    ...(options.extraParams || {}),
  });

  const offset = getUtcOffsetSeconds(data);

  if (!data?.daily?.time || !Array.isArray(data.daily.time) || data.daily.time.length === 0) {
    return { plotId: String(plotId), date: target, status: "no_data" };
  }

  const i = 0;

  const archiveDate = toDateFromUnixWithOffset(data.daily.time[i], offset) || new Date(`${target}T00:00:00.000Z`);

  const tMax = data.daily.temperature_2m_max?.[i];
  const tMin = data.daily.temperature_2m_min?.[i];
  const tMean = data.daily.temperature_2m_mean?.[i] ?? (tMax != null && tMin != null ? (tMax + tMin) / 2 : null);

  const precipitationSum = data.daily.precipitation_sum?.[i];
  const rainSum = data.daily.rain_sum?.[i];
  const rainfallMm = precipitationSum ?? rainSum ?? 0;

  const hourlyRH = data.hourly?.relative_humidity_2m || [];
  const hourlyDP = data.hourly?.dew_point_2m || [];
  const hourlyVPD = data.hourly?.vapour_pressure_deficit || [];
  const hourlyVis = data.hourly?.visibility || [];
  const hourlyCloud = data.hourly?.cloud_cover || [];
  const hourlyPress = data.hourly?.surface_pressure || [];
  const hourlyTemp = data.hourly?.temperature_2m || [];
  const hourlyEvapo = data.hourly?.evapotranspiration || [];
  const hourlyEt0 = data.hourly?.et0_fao_evapotranspiration || [];

  const rhMean = mean(hourlyRH);
  const rhMorning = mean(sliceHours(hourlyRH, 6, 9)) ?? rhMean;
  const rhEvening = mean(sliceHours(hourlyRH, 15, 18)) ?? rhMean;

  const dewPointMean = mean(hourlyDP);
  const vpdMean = mean(hourlyVPD);
  const visibilityMean = mean(hourlyVis);
  const cloudCoverMean = mean(hourlyCloud);
  const pressureMean = mean(hourlyPress);

  const leafWetnessHours = calcLeafWetnessHoursFromHourly(data.hourly);

  const sunshineDurationSec = data.daily.sunshine_duration?.[i];
  const sunshineHours = typeof sunshineDurationSec === "number" ? sunshineDurationSec / 3600 : null;

  const daylightDurationSec = data.daily.daylight_duration?.[i];
  const dayLengthHours = typeof daylightDurationSec === "number" ? daylightDurationSec / 3600 : null;

  const et0 = data.daily.et0_fao_evapotranspiration?.[i] ?? mean(hourlyEt0);
  const evapotranspirationMean = mean(hourlyEvapo);

  const panEvaporation = typeof et0 === "number" ? et0 * 0.8 : null;

  const soilTemp0Mean = mean(data.hourly?.soil_temperature_0cm);
  const sm0 = mean(data.hourly?.soil_moisture_0_to_1cm);
  const sm1 = mean(data.hourly?.soil_moisture_1_to_3cm);
  const sm3 = mean(data.hourly?.soil_moisture_3_to_9cm);
  const soilMoisture0to10cmMean =
    [sm0, sm1, sm3].filter((v) => typeof v === "number").length
      ? [sm0, sm1, sm3].filter((v) => typeof v === "number").reduce((a, b) => a + b, 0) /
        [sm0, sm1, sm3].filter((v) => typeof v === "number").length
      : null;

  const fogFlag = calcFogFlag(rhMean, visibilityMean);

  const gddBase = options.gddBase ?? 10;
  const gddDaily = calcGddDaily(tMax, tMin, gddBase);

  // absolute humidity mean
  let absoluteHumidityMean = null;
  if (hourlyTemp.length && hourlyRH.length) {
    const ahArr = [];
    for (let k = 0; k < Math.min(hourlyTemp.length, hourlyRH.length); k++) {
      const ah = calcAbsoluteHumidity(hourlyTemp[k], hourlyRH[k]);
      if (typeof ah === "number" && Number.isFinite(ah)) ahArr.push(ah);
    }
    absoluteHumidityMean = mean(ahArr);
  }

  const allParams = {};
  Object.keys(data.daily).forEach((k) => {
    if (k === "time") return;
    allParams[k] = Array.isArray(data.daily[k]) ? data.daily[k][i] : null;
  });

  const windMax = data.daily.wind_speed_10m_max?.[i];
  const code = data.daily.weather_code?.[i];

  await WeatherDaily.findOneAndUpdate(
    { plot: plotId, date: archiveDate },
    {
      plot: plotId,
      date: archiveDate,

      tMax,
      tMin,
      tMean,

      rhMean,
      rhMorning,
      rhEvening,

      rainfallMm,

      windSpeed: windMax,
      windDirectionDominant: data.daily.wind_direction_10m_dominant?.[i],
      windGustsMax: data.daily.wind_gusts_10m_max?.[i],

      solarRadiation: data.daily.shortwave_radiation_sum?.[i],
      sunshineHours,
      sunshineDurationSec,
      sunrise: toDateFromUnixWithOffset(data.daily.sunrise?.[i], offset),
      sunset: toDateFromUnixWithOffset(data.daily.sunset?.[i], offset),
      daylightDurationSec,
      dayLengthHours,

      leafWetnessHours,
      fogFlag,

      dewPointMean,
      vpdMean,
      pressureMean,
      cloudCoverMean,
      visibilityMean,
      absoluteHumidityMean,

      et0,
      evapotranspirationMean,
      panEvaporation,

      soilTemperature0cmMean: soilTemp0Mean,
      soilMoisture0to10cmMean,

      gddDaily,
      gddBase,

      weatherCode: code,
      apparentMax: data.daily.apparent_temperature_max?.[i],
      apparentMin: data.daily.apparent_temperature_min?.[i],
      uvIndexMax: data.daily.uv_index_max?.[i],

      extremes: extremeFlags(tMax, tMin, rainfallMm, windMax, code),

      isForecast: false,
      source: "OPEN_METEO",

      allParams,
      raw: options.saveRaw ? data : {},
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { plotId: String(plotId), date: target, status: "archived" };
}

module.exports = {
  ingestWeatherForPlotFromOpenMeteo,
  syncDailyArchive,
};