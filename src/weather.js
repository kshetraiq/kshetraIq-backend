const { fetchWeatherApi } = require("openmeteo");
const fs = require("fs/promises");
const path = require("path");

async function main() {
  const params = {
    // location for chilakaluripet
    latitude: 16.0924301,
    longitude: 80.1623948,
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
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
    ],
    hourly: [
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
      "wind_speed_80m",
      "wind_speed_120m",
      "wind_speed_180m",
      "wind_direction_10m",
      "wind_direction_80m",
      "wind_direction_120m",
      "wind_direction_180m",
      "wind_gusts_10m",
      "temperature_80m",
      "temperature_120m",
      "temperature_180m",
      "soil_temperature_0cm",
      "soil_temperature_6cm",
      "soil_temperature_18cm",
      "soil_temperature_54cm",
      "soil_moisture_0_to_1cm",
      "soil_moisture_1_to_3cm",
      "soil_moisture_3_to_9cm",
      "soil_moisture_9_to_27cm",
      "soil_moisture_27_to_81cm",
    ],
    current: [
      "temperature_2m",
      "relative_humidity_2m",
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
    ],
    timezone: "auto",
    past_days: 7,
  };

  const url = "https://api.open-meteo.com/v1/forecast";
  const responses = await fetchWeatherApi(url, params);
  const response = responses[0];
  if (!response) throw new Error("No response from Open-Meteo");

  const utcOffsetSeconds = response.utcOffsetSeconds();

  const current = response.current();
  const hourly = response.hourly();
  const daily = response.daily();
  if (!current || !hourly || !daily) throw new Error("Missing blocks");

  // sunrise/sunset indices must match daily[] order
  const sunriseVar = daily.variables(10);
  const sunsetVar = daily.variables(11);
  if (!sunriseVar || !sunsetVar) throw new Error("Missing sunrise/sunset vars");

  const hourlyLen =
    (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval();
  const dailyLen =
    (Number(daily.timeEnd()) - Number(daily.time())) / daily.interval();

  const weatherData = {
    meta: {
      latitude: response.latitude(),
      longitude: response.longitude(),
      elevation: response.elevation(),
      timezone: response.timezone(),
      timezoneAbbreviation: response.timezoneAbbreviation(),
      utcOffsetSeconds,
      fetchedAt: new Date().toISOString(),
    },

    current: {
      time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000).toISOString(),
      temperature_2m: current.variables(0)?.value() ?? null,
      relative_humidity_2m: current.variables(1)?.value() ?? null,
      apparent_temperature: current.variables(2)?.value() ?? null,
      is_day: current.variables(3)?.value() ?? null,
      wind_speed_10m: current.variables(4)?.value() ?? null,
      wind_direction_10m: current.variables(5)?.value() ?? null,
      wind_gusts_10m: current.variables(6)?.value() ?? null,
      precipitation: current.variables(7)?.value() ?? null,
      rain: current.variables(8)?.value() ?? null,
      showers: current.variables(9)?.value() ?? null,
      snowfall: current.variables(10)?.value() ?? null,
      surface_pressure: current.variables(11)?.value() ?? null,
      pressure_msl: current.variables(12)?.value() ?? null,
      cloud_cover: current.variables(13)?.value() ?? null,
      weather_code: current.variables(14)?.value() ?? null,
    },

    hourly: {
      time: Array.from({ length: hourlyLen }, (_, i) =>
        new Date(
          (Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000
        ).toISOString()
      ),
      temperature_2m: hourly.variables(0)?.valuesArray() ?? [],
      relative_humidity_2m: hourly.variables(1)?.valuesArray() ?? [],
      dew_point_2m: hourly.variables(2)?.valuesArray() ?? [],
      apparent_temperature: hourly.variables(3)?.valuesArray() ?? [],
      precipitation_probability: hourly.variables(4)?.valuesArray() ?? [],
      precipitation: hourly.variables(5)?.valuesArray() ?? [],
      rain: hourly.variables(6)?.valuesArray() ?? [],
      showers: hourly.variables(7)?.valuesArray() ?? [],
      snowfall: hourly.variables(8)?.valuesArray() ?? [],
      snow_depth: hourly.variables(9)?.valuesArray() ?? [],
      vapour_pressure_deficit: hourly.variables(10)?.valuesArray() ?? [],
      weather_code: hourly.variables(11)?.valuesArray() ?? [],
      pressure_msl: hourly.variables(12)?.valuesArray() ?? [],
      surface_pressure: hourly.variables(13)?.valuesArray() ?? [],
      cloud_cover: hourly.variables(14)?.valuesArray() ?? [],
      cloud_cover_low: hourly.variables(15)?.valuesArray() ?? [],
      cloud_cover_mid: hourly.variables(16)?.valuesArray() ?? [],
      cloud_cover_high: hourly.variables(17)?.valuesArray() ?? [],
      visibility: hourly.variables(18)?.valuesArray() ?? [],
      evapotranspiration: hourly.variables(19)?.valuesArray() ?? [],
      et0_fao_evapotranspiration: hourly.variables(20)?.valuesArray() ?? [],
      wind_speed_10m: hourly.variables(21)?.valuesArray() ?? [],
      wind_speed_80m: hourly.variables(22)?.valuesArray() ?? [],
      wind_speed_120m: hourly.variables(23)?.valuesArray() ?? [],
      wind_speed_180m: hourly.variables(24)?.valuesArray() ?? [],
      wind_direction_10m: hourly.variables(25)?.valuesArray() ?? [],
      wind_direction_80m: hourly.variables(26)?.valuesArray() ?? [],
      wind_direction_120m: hourly.variables(27)?.valuesArray() ?? [],
      wind_direction_180m: hourly.variables(28)?.valuesArray() ?? [],
      wind_gusts_10m: hourly.variables(29)?.valuesArray() ?? [],
      temperature_80m: hourly.variables(30)?.valuesArray() ?? [],
      temperature_120m: hourly.variables(31)?.valuesArray() ?? [],
      temperature_180m: hourly.variables(32)?.valuesArray() ?? [],
      soil_temperature_0cm: hourly.variables(33)?.valuesArray() ?? [],
      soil_temperature_6cm: hourly.variables(34)?.valuesArray() ?? [],
      soil_temperature_18cm: hourly.variables(35)?.valuesArray() ?? [],
      soil_temperature_54cm: hourly.variables(36)?.valuesArray() ?? [],
      soil_moisture_0_to_1cm: hourly.variables(37)?.valuesArray() ?? [],
      soil_moisture_1_to_3cm: hourly.variables(38)?.valuesArray() ?? [],
      soil_moisture_3_to_9cm: hourly.variables(39)?.valuesArray() ?? [],
      soil_moisture_9_to_27cm: hourly.variables(40)?.valuesArray() ?? [],
      soil_moisture_27_to_81cm: hourly.variables(41)?.valuesArray() ?? [],
    },

    daily: {
      time: Array.from({ length: dailyLen }, (_, i) =>
        new Date(
          (Number(daily.time()) + i * daily.interval() + utcOffsetSeconds) * 1000
        ).toISOString()
      ),
      weather_code: daily.variables(0)?.valuesArray() ?? [],
      temperature_2m_max: daily.variables(1)?.valuesArray() ?? [],
      temperature_2m_min: daily.variables(2)?.valuesArray() ?? [],
      apparent_temperature_max: daily.variables(3)?.valuesArray() ?? [],
      apparent_temperature_min: daily.variables(4)?.valuesArray() ?? [],
      wind_speed_10m_max: daily.variables(5)?.valuesArray() ?? [],
      wind_gusts_10m_max: daily.variables(6)?.valuesArray() ?? [],
      wind_direction_10m_dominant: daily.variables(7)?.valuesArray() ?? [],
      shortwave_radiation_sum: daily.variables(8)?.valuesArray() ?? [],
      et0_fao_evapotranspiration: daily.variables(9)?.valuesArray() ?? [],
      sunrise: Array.from({ length: sunriseVar.valuesInt64Length() }, (_, i) =>
        new Date((Number(sunriseVar.valuesInt64(i)) + utcOffsetSeconds) * 1000).toISOString()
      ),
      sunset: Array.from({ length: sunsetVar.valuesInt64Length() }, (_, i) =>
        new Date((Number(sunsetVar.valuesInt64(i)) + utcOffsetSeconds) * 1000).toISOString()
      ),
      daylight_duration: daily.variables(12)?.valuesArray() ?? [],
      sunshine_duration: daily.variables(13)?.valuesArray() ?? [],
      uv_index_max: daily.variables(14)?.valuesArray() ?? [],
      uv_index_clear_sky_max: daily.variables(15)?.valuesArray() ?? [],
      rain_sum: daily.variables(16)?.valuesArray() ?? [],
      showers_sum: daily.variables(17)?.valuesArray() ?? [],
      snowfall_sum: daily.variables(18)?.valuesArray() ?? [],
      precipitation_sum: daily.variables(19)?.valuesArray() ?? [],
      precipitation_hours: daily.variables(20)?.valuesArray() ?? [],
      precipitation_probability_max: daily.variables(21)?.valuesArray() ?? [],
    },
  };

  // ✅ Write to a JSON file
  const outDir = path.join(process.cwd(), "weather-json");
  await fs.mkdir(outDir, { recursive: true });

  const safeLat = String(params.latitude).replace(".", "_");
  const safeLon = String(params.longitude).replace(".", "_");
  const fileName = `openmeteo_${safeLat}_${safeLon}_${Date.now()}.json`;
  const filePath = path.join(outDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(weatherData, null, 2), "utf-8");
  console.log("✅ Saved weather JSON to:", filePath);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});