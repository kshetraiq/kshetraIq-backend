// // src/services/weatherFetcher.js
// const axios = require("axios");

// /**
//  * Fetch rich weather data for a given latitude & longitude
//  * using the free Open-Meteo API (no API key required).
//  *
//  * It returns:
//  *  - hourly: temperature, humidity, wind, rain
//  *  - daily: max/min temp, rain, wind, solar radiation, sunshine
//  *
//  * @param {number} lat  - latitude (e.g. 16.086)
//  * @param {number} lon  - longitude (e.g. 80.169)
//  * @param {object} extraParams - optional overrides
//  */
// async function fetchWeatherForLatLon(lat, lon, extraParams = {}) {
//   // You can tune which variables you want in hourly/daily
//   const baseParams = {
//     latitude: lat,
//     longitude: lon,
//     // hourly variables
//     hourly: [
//       "temperature_2m",
//       "relativehumidity_2m",
//       "dewpoint_2m",
//       "rain",
//       "surface_pressure",
//       "windspeed_10m",
//       "winddirection_10m",
//       "shortwave_radiation",
//       "precipitation_probability",
//     ].join(","),
//     // daily aggregates
//     daily: [
//       "temperature_2m_max",
//       "temperature_2m_min",
//       "temperature_2m_mean",
//       "precipitation_sum",
//       "windspeed_10m_max",
//       "shortwave_radiation_sum",
//       "sunshine_duration",
//     ].join(","),
//     current: [
//       "temperature_2m",
//       "relative_humidity_2m",
//       "apparent_temperature",
//       "is_day",
//       "precipitation",
//       "rain",
//       "weather_code",
//       "cloud_cover",
//       "pressure_msl",
//       "surface_pressure",
//       "wind_speed_10m",
//       "wind_direction_10m"
//     ].join(","),
//     timezone: "auto",
//   };

//   const params = { ...baseParams, ...extraParams };

//   const url = "https://api.open-meteo.com/v1/forecast";

//   try {
//     const response = await axios.get(url, { params });

//     // Raw Open-Meteo response (you can map it into WeatherDaily later)
//     return response.data;
//   } catch (err) {
//     console.error("❌ Error fetching weather:", err.message);
//     throw new Error("Failed to fetch weather data");
//   }
// }

// module.exports = { fetchWeatherForLatLon };









// src/services/weatherFetcher.js
/**
 * Comprehensive Weather Data Fetcher for Agricultural Disease Prediction
 * Integrates multiple weather sources with full parameter support
 * 
 * Fetches from:
 * 1. Open-Meteo (primary - free, comprehensive)
 * 2. BFS/Mausamgram (secondary - Indian hyperlocal)
 * 3. APSDPS (tertiary - Andhra Pradesh ground truth)
 */

const axios = require("axios");

/**
 * ============================================================================
 * WEATHER PARAMETER DEFINITIONS
 * ============================================================================
 * All weather parameters available for agricultural disease prediction
 */

const WEATHER_PARAMETERS = {
  // TEMPERATURE PARAMETERS
  temperature: {
    temp_max: "Maximum daily temperature (°C)",
    temp_min: "Minimum daily temperature (°C)",
    temp_mean: "Mean daily temperature (°C)",
    temp_current: "Current temperature (°C)",
    temp_feels_like: "Feels-like temperature (°C)",
  },

  // HUMIDITY PARAMETERS (Critical for fungal diseases!)
  humidity: {
    rh_morning: "Relative Humidity - Morning (%) [6-9 AM]",
    rh_afternoon: "Relative Humidity - Afternoon (%) [12-3 PM]",
    rh_evening: "Relative Humidity - Evening (%) [6-9 PM]",
    rh_mean: "Mean Relative Humidity (%)",
    dew_point: "Dew Point Temperature (°C)",
    absolute_humidity: "Absolute Humidity (g/m³)",
    specific_humidity: "Specific Humidity (g/kg)",
  },

  // LEAF WETNESS & MOISTURE (Critical for fungal infection!)
  leafWetness: {
    leaf_wetness_hours: "Leaf Wetness Duration (hours/day) - Fungal infection trigger",
    leaf_wetness_periods: "Number of leaf wetness periods per day",
    surface_moisture: "Surface moisture presence (0-1 scale)",
  },

  // RAINFALL PARAMETERS (Spore germination trigger)
  rainfall: {
    rain_amount: "Total rainfall (mm/day)",
    rain_probability: "Probability of rainfall (%)",
    rain_intensity: "Rainfall intensity (light/moderate/heavy/very heavy)",
    rain_duration: "Rainfall duration (hours)",
    rain_frequency: "Number of rain events per day",
  },

  // WIND PARAMETERS
  wind: {
    wind_speed_mean: "Mean wind speed (m/s)",
    wind_speed_max: "Maximum wind speed (m/s)",
    wind_direction: "Wind direction (degrees 0-360, or N/NE/E/etc)",
    wind_gust: "Wind gust speed (m/s)",
  },

  // SOLAR RADIATION & SUNSHINE
  solar: {
    solar_radiation: "Solar radiation (W/m² or MJ/m²/day)",
    sunshine_hours: "Actual sunshine hours (hours/day)",
    sunshine_percentage: "Sunshine percentage (% of daylight)",
    shortwave_radiation: "Shortwave radiation (W/m²)",
  },

  // ATMOSPHERIC PARAMETERS
  atmosphere: {
    atmospheric_pressure: "Atmospheric pressure (hPa or mb)",
    surface_pressure: "Surface pressure (hPa)",
    cloud_cover: "Cloud cover (%)",
    visibility: "Visibility (km or meters)",
    weather_code: "Weather condition code (WMO)",
  },

  // EVAPOTRANSPIRATION & WATER DEMAND
  waterDemand: {
    evapotranspiration: "Reference evapotranspiration (ET0, mm/day)",
    pan_evaporation: "Pan evaporation (mm/day)",
    vpd: "Vapor Pressure Deficit (hPa or kPa) - Plant water stress indicator",
  },

  // SOIL PARAMETERS
  soil: {
    soil_temperature: "Soil temperature at depth (°C)",
    soil_moisture: "Soil moisture content (mm or %)",
    soil_type: "Soil type (red/black/loamy/sandy/rocky/hilly)",
  },

  // FOG & FROST (Critical for certain diseases)
  extremeEvents: {
    fog_presence: "Fog presence (0-1 or hours)",
    frost_risk: "Frost risk indicator (0-1 scale)",
    hail_probability: "Hail probability (%)",
    heatwave_risk: "Heatwave risk indicator",
    thunderstorm_probability: "Thunderstorm probability (%)",
    lightning_probability: "Lightning probability (%)",
  },

  // PHOTOPERIOD (Crop development stages)
  photoperiod: {
    day_length: "Day length / Photoperiod (hours)",
    sunrise_time: "Sunrise time (HH:MM)",
    sunset_time: "Sunset time (HH:MM)",
  },
};

/**
 * CROP & MANAGEMENT PARAMETERS
 * Non-weather data needed for disease prediction
 */
const CROP_PARAMETERS = {
  // Crop Details
  crop: {
    crop_name: "Crop name (rice, wheat, cotton, etc)",
    variety_hybrid: "Variety or hybrid name/type",
    sowing_date: "Sowing/planting date (YYYY-MM-DD)",
  },

  // Soil & Location
  soilManagement: {
    soil_type: "Soil type (red/black/loamy/sandy/rocky/hilly)",
    soil_ph: "Soil pH (6.0-7.5 typical)",
  },

  // Irrigation
  irrigation: {
    irrigation_type: "Irrigation method (rainfed/canal/drip/sprinkler/well)",
    last_irrigation_date: "Date of last irrigation",
    irrigation_frequency: "Irrigation frequency (days)",
  },

  // Crop Season
  cropSeason: {
    season: "Crop season (kharif/rabi/summer/spring)",
  },

  // Fertility Management
  fertility: {
    nitrogen_applied: "Nitrogen applied (kg/hectare)",
    phosphorus_applied: "Phosphorus applied (kg/hectare)",
    potassium_applied: "Potassium applied (kg/hectare)",
    nitrogen_stage: "N application growth stage",
    last_fertilizer_date: "Last fertilizer application date",
  },

  // Planting Details
  planting: {
    planting_density: "Plant density (plants/hectare or acre)",
    row_spacing: "Row spacing (cm)",
    plant_height_stage: "Current plant growth stage (height in cm or BBCH stage)",
  },

  // Previous Crop
  cropHistory: {
    previous_crop: "Previous crop grown",
    crop_rotation: "Crop rotation pattern",
  },

  // Pesticide History
  pesticides: {
    last_fungicide_date: "Last fungicide application date",
    last_fungicide_type: "Last fungicide type applied",
    fungicide_frequency: "Fungicide application frequency (days)",
  },
};

/**
 * ============================================================================
 * MAIN WEATHER FETCHER CLASS
 * ============================================================================
 */

class WeatherDataFetcher {
  constructor(config = {}) {
    this.config = {
      openMeteoUrl: "https://api.open-meteo.com/v1/forecast",
      timezone: config.timezone || "Asia/Kolkata",
      forecastDays: config.forecastDays || 10,
      retryAttempts: config.retryAttempts || 3,
      ...config,
    };

    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes cache
  }

  /**
   * Fetch comprehensive weather data from Open-Meteo (PRIMARY SOURCE)
   * Returns all weather parameters for disease prediction
   */
  async fetchWeatherFromOpenMeteo(lat, lon) {
    try {
      const cacheKey = `openmeteo_${lat}_${lon}`;

      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          console.log("✓ Using cached Open-Meteo data");
          return cached.data;
        }
      }

      const params = {
        latitude: lat,
        longitude: lon,
        timezone: this.config.timezone,
        forecast_days: this.config.forecastDays,

        // HOURLY WEATHER PARAMETERS
        hourly: [
          // Temperature
          "temperature_2m",
          "apparent_temperature",
          "dew_point_2m",

          // Humidity & Moisture
          "relative_humidity_2m",

          // Precipitation
          "precipitation",
          "rain",
          "precipitation_probability",

          // Wind
          "windspeed_10m",
          "winddirection_10m",
          "windgusts_10m",

          // Solar & Radiation
          "shortwave_radiation",

          // Atmospheric
          "surface_pressure",
          "cloudcover",
          "visibility",
          "weather_code",

          // Additional
          "soil_temperature_0cm",
          "soil_moisture_0_to_10cm",
        ].join(","),

        // DAILY AGGREGATES
        daily: [
          // Temperature
          "temperature_2m_max",
          "temperature_2m_min",
          "temperature_2m_mean",
          "apparent_temperature_max",
          "apparent_temperature_min",

          // Precipitation
          "precipitation_sum",
          "precipitation_probability_max",
          "precipitation_probability_min",

          // Wind
          "windspeed_10m_max",
          "winddirection_10m_dominant",

          // Solar
          "shortwave_radiation_sum",
          "sunshine_duration",

          // Extreme Events
          "weather_code",
        ].join(","),

        // CURRENT CONDITIONS
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "precipitation",
          "rain",
          "weather_code",
          "cloud_cover",
          "pressure_msl",
          "surface_pressure",
          "windspeed_10m",
          "winddirection_10m",
          "is_day",
        ].join(","),
      };

      console.log(`📡 Fetching weather from Open-Meteo for (${lat}, ${lon})...`);
      const response = await axios.get(this.config.openMeteoUrl, { params });

      // Cache the response
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });

      return response.data;
    } catch (error) {
      console.error("❌ Open-Meteo fetch failed:", error.message);
      throw error;
    }
  }

  /**
   * Process Open-Meteo data into standardized format
   * Maps raw API response to our weather parameter schema
   */
  processOpenMeteoData(rawData) {
    const processed = {
      source: "Open-Meteo",
      location: {
        latitude: rawData.latitude,
        longitude: rawData.longitude,
        elevation: rawData.elevation || null,
      },
      timezone: rawData.timezone,
      generatedAt: new Date().toISOString(),

      // CURRENT CONDITIONS
      current: {
        temperature: {
          temp_current: rawData.current?.temperature_2m || null,
          temp_feels_like: rawData.current?.apparent_temperature || null,
          dew_point: rawData.current?.dew_point_2m || null,
        },
        humidity: {
          rh_mean: rawData.current?.relative_humidity_2m || null,
        },
        rainfall: {
          rain_amount: rawData.current?.rain || 0,
          precipitation: rawData.current?.precipitation || 0,
        },
        wind: {
          wind_speed_current: rawData.current?.windspeed_10m || null,
          wind_direction: rawData.current?.winddirection_10m || null,
        },
        atmosphere: {
          atmospheric_pressure: rawData.current?.pressure_msl || null,
          cloud_cover: rawData.current?.cloud_cover || null,
          weather_code: rawData.current?.weather_code || null,
        },
      },

      // HOURLY FORECAST (For detailed disease risk tracking)
      hourly: this.processHourlyData(rawData.hourly),

      // DAILY FORECAST
      daily: this.processDailyData(rawData.daily),

      // DERIVED PARAMETERS (Calculated for disease models)
      derived: this.calculateDerivedParameters(rawData),
    };

    return processed;
  }

  /**
   * Process hourly weather data
   */
  processHourlyData(hourlyData) {
    if (!hourlyData || !hourlyData.time) {
      return [];
    }

    return hourlyData.time.map((time, index) => ({
      timestamp: new Date(time + "Z").toISOString(),
      temperature: {
        temp_current: hourlyData.temperature_2m[index] || null,
        temp_feels_like: hourlyData.apparent_temperature[index] || null,
        dew_point: hourlyData.dew_point_2m[index] || null,
      },
      humidity: {
        rh_mean: hourlyData.relative_humidity_2m[index] || null,
      },
      rainfall: {
        rain_amount: hourlyData.rain[index] || 0,
        rain_probability: hourlyData.precipitation_probability[index] || 0,
      },
      wind: {
        wind_speed_mean: hourlyData.windspeed_10m[index] || null,
        wind_direction: hourlyData.winddirection_10m[index] || null,
        wind_gust: hourlyData.windgusts_10m?.[index] || null,
      },
      solar: {
        shortwave_radiation: hourlyData.shortwave_radiation[index] || null,
      },
      atmosphere: {
        surface_pressure: hourlyData.surface_pressure[index] || null,
        cloud_cover: hourlyData.cloudcover[index] || null,
        visibility: hourlyData.visibility[index] || null,
      },
      soil: {
        soil_temperature: hourlyData.soil_temperature_0cm?.[index] || null,
        soil_moisture:
          hourlyData.soil_moisture_0_to_10cm?.[index] || null,
      },
    }));
  }

  /**
   * Process daily weather aggregates
   */
  processDailyData(dailyData) {
    if (!dailyData || !dailyData.time) {
      return [];
    }

    return dailyData.time.map((time, index) => ({
      date: time,
      temperature: {
        temp_max: dailyData.temperature_2m_max[index] || null,
        temp_min: dailyData.temperature_2m_min[index] || null,
        temp_mean: dailyData.temperature_2m_mean[index] || null,
      },
      rainfall: {
        rain_amount: dailyData.precipitation_sum[index] || 0,
        rain_probability_max: dailyData.precipitation_probability_max[index] || 0,
      },
      wind: {
        wind_speed_max: dailyData.windspeed_10m_max[index] || null,
        wind_direction: dailyData.winddirection_10m_dominant[index] || null,
      },
      solar: {
        solar_radiation: dailyData.shortwave_radiation_sum[index] || null,
        sunshine_hours: (dailyData.sunshine_duration[index] || 0) / 3600, // Convert seconds to hours
      },
      weather_code: dailyData.weather_code[index] || null,
    }));
  }

  /**
   * Calculate derived parameters for disease prediction
   * These are key indicators for fungal disease risk
   */
  calculateDerivedParameters(rawData) {
    const derived = {
      leafWetness: this.calculateLeafWetness(rawData),
      diseasePressure: this.calculateDiseasePressure(rawData),
      growingDegreeDays: this.calculateGrowingDegreeDays(rawData),
      evapotranspiration: this.calculateEvapotranspiration(rawData),
      extremeEvents: this.identifyExtremeEvents(rawData),
    };

    return derived;
  }

  /**
   * Calculate leaf wetness duration (hours with humidity >80% and rain/dew)
   * Critical for fungal disease infection
   */
  calculateLeafWetness(rawData) {
    if (!rawData.hourly) {
      return {
        leaf_wetness_hours: 0,
        leaf_wetness_periods: [],
      };
    }

    let leafWetnessHours = 0;
    const wetnessPeriods = [];
    let currentPeriod = null;

    rawData.hourly.time.forEach((time, index) => {
      const humidity = rawData.hourly.relative_humidity_2m[index] || 0;
      const rain = rawData.hourly.rain[index] || 0;
      const hasWetness = humidity >= 80 || rain > 0;

      if (hasWetness) {
        leafWetnessHours++;

        if (!currentPeriod) {
          currentPeriod = {
            startTime: time,
            endTime: time,
            hours: 1,
            maxHumidity: humidity,
          };
        } else {
          currentPeriod.endTime = time;
          currentPeriod.hours++;
          currentPeriod.maxHumidity = Math.max(
            currentPeriod.maxHumidity,
            humidity
          );
        }
      } else {
        if (currentPeriod && currentPeriod.hours >= 2) {
          // Only count periods >= 2 hours
          wetnessPeriods.push(currentPeriod);
        }
        currentPeriod = null;
      }
    });

    if (currentPeriod && currentPeriod.hours >= 2) {
      wetnessPeriods.push(currentPeriod);
    }

    return {
      leaf_wetness_hours: leafWetnessHours,
      leaf_wetness_periods: wetnessPeriods,
      high_risk_hours: wetnessPeriods.filter((p) => p.hours >= 4).length * 4,
    };
  }

  /**
   * Calculate disease pressure index (0-10 scale)
   * Based on: humidity, rainfall, temperature, wind speed
   */
  calculateDiseasePressure(rawData) {
    if (!rawData.daily || !rawData.daily.time) {
      return [];
    }

    return rawData.daily.time.map((date, index) => {
      const tempMax = rawData.daily.temperature_2m_max[index] || 0;
      const tempMin = rawData.daily.temperature_2m_min[index] || 0;
      const tempMean = rawData.daily.temperature_2m_mean[index] || 0;
      const rain = rawData.daily.precipitation_sum[index] || 0;
      const windMax = rawData.daily.windspeed_10m_max[index] || 0;

      let pressure = 0;

      // Optimal temperature for most fungal diseases: 18-28°C
      if (tempMean >= 18 && tempMean <= 28) {
        pressure += 3;
      } else if (tempMean >= 15 && tempMean <= 30) {
        pressure += 2;
      }

      // Rainfall increases disease pressure
      if (rain >= 5) {
        pressure += 3;
      } else if (rain >= 1) {
        pressure += 2;
      }

      // Low wind speed keeps moisture on leaves
      if (windMax < 5) {
        pressure += 2;
      } else if (windMax < 10) {
        pressure += 1;
      }

      // Scale to 0-10
      const scaledPressure = Math.min(pressure, 10);

      return {
        date,
        disease_pressure_index: scaledPressure,
        risk_level:
          scaledPressure >= 7
            ? "HIGH"
            : scaledPressure >= 4
              ? "MODERATE"
              : "LOW",
        factors: {
          temperature_favorable: tempMean >= 18 && tempMean <= 28,
          rainfall_present: rain >= 1,
          low_wind: windMax < 10,
        },
      };
    });
  }

  /**
   * Calculate Growing Degree Days (GDD)
   * Tracks cumulative heat for crop phenological stages
   * Formula: GDD = ((Tmax + Tmin) / 2) - Tbase
   * Tbase = 10°C typically
   */
  calculateGrowingDegreeDays(rawData, tBase = 10) {
    if (!rawData.daily) {
      return [];
    }

    let cumulativeGDD = 0;

    return rawData.daily.time.map((date, index) => {
      const tMax = rawData.daily.temperature_2m_max[index] || 0;
      const tMin = rawData.daily.temperature_2m_min[index] || 0;

      const tMean = (tMax + tMin) / 2;
      const dailyGDD = Math.max(tMean - tBase, 0);
      cumulativeGDD += dailyGDD;

      return {
        date,
        daily_gdd: parseFloat(dailyGDD.toFixed(2)),
        cumulative_gdd: parseFloat(cumulativeGDD.toFixed(2)),
        growth_stage: this.predictGrowthStage(cumulativeGDD),
      };
    });
  }

  /**
   * Predict crop growth stage from GDD
   * Typical values (vary by crop):
   * 0-200: Germination & emergence
   * 200-500: Vegetative growth
   * 500-800: Reproductive (flowering)
   * >800: Maturity & harvest
   */
  predictGrowthStage(cumulativeGDD) {
    if (cumulativeGDD < 200) {
      return "Germination & Emergence";
    } else if (cumulativeGDD < 500) {
      return "Vegetative Growth";
    } else if (cumulativeGDD < 800) {
      return "Reproductive (Flowering)";
    } else {
      return "Maturity & Harvest";
    }
  }

  /**
   * Calculate Reference Evapotranspiration (ET0) - simplified
   * Actual formula uses Penman-Monteith but this is approximation
   */
  calculateEvapotranspiration(rawData) {
    if (!rawData.daily) {
      return [];
    }

    return rawData.daily.time.map((date, index) => {
      const tempMax = rawData.daily.temperature_2m_max[index] || 0;
      const tempMin = rawData.daily.temperature_2m_min[index] || 0;
      const radiation = rawData.daily.shortwave_radiation_sum[index] || 0;
      const windMax = rawData.daily.windspeed_10m_max[index] || 0;

      // Simplified ET0 calculation (mm/day)
      // Real implementation would use full Penman-Monteith equation
      const et0 = (
        0.0023 *
        windMax *
        ((tempMax + tempMin) / 2 + 17.8) *
        Math.sqrt(tempMax - tempMin) *
        (radiation / 2450)
      ).toFixed(2);

      return {
        date,
        evapotranspiration: parseFloat(et0),
        pan_evaporation: (parseFloat(et0) * 0.8).toFixed(2), // Pan evaporation ~ 0.8 * ET0
      };
    });
  }

  /**
   * Identify extreme weather events
   * Important for crop damage risk
   */
  identifyExtremeEvents(rawData) {
    if (!rawData.daily) {
      return [];
    }

    return rawData.daily.time.map((date, index) => {
      const tempMax = rawData.daily.temperature_2m_max[index] || 0;
      const tempMin = rawData.daily.temperature_2m_min[index] || 0;
      const rain = rawData.daily.precipitation_sum[index] || 0;
      const windMax = rawData.daily.windspeed_10m_max[index] || 0;
      const weatherCode = rawData.daily.weather_code[index] || 0;

      const events = [];

      if (tempMax > 35) {
        events.push({ type: "HEATWAVE", severity: "HIGH", value: tempMax });
      }
      if (tempMin < 0) {
        events.push({ type: "FROST", severity: "HIGH", value: tempMin });
      }
      if (rain > 50) {
        events.push({
          type: "HEAVY_RAINFALL",
          severity: "MODERATE",
          value: rain,
        });
      }
      if (windMax > 40) {
        events.push({ type: "HIGH_WIND", severity: "HIGH", value: windMax });
      }
      if (weatherCode >= 95) {
        events.push({ type: "THUNDERSTORM", severity: "MODERATE" });
      }

      return {
        date,
        extreme_events: events,
        has_extremes: events.length > 0,
      };
    });
  }

  /**
   * Get complete weather data with all parameters
   * Main entry point for disease prediction system
   */
  async getCompleteWeatherData(lat, lon, cropData = {}) {
    try {
      // Fetch raw data from Open-Meteo
      const rawData = await this.fetchWeatherFromOpenMeteo(lat, lon);

      // Process and standardize the data
      const processedData = this.processOpenMeteoData(rawData);

      // Add crop and management parameters
      processedData.cropData = cropData;

      return processedData;
    } catch (error) {
      console.error("❌ Failed to get complete weather data:", error.message);
      throw error;
    }
  }

  /**
   * Format weather data for disease prediction model
   * Creates structured input for ML model
   */
  formatForDiseaseModel(weatherData, cropData = {}) {
    const formatted = {
      timestamp: new Date().toISOString(),

      // CRITICAL DISEASE INDICATORS
      diseaseIndicators: {
        leaf_wetness_hours:
          weatherData.derived.leafWetness.leaf_wetness_hours || 0,
        disease_pressure_index: weatherData.derived.diseasePressure[0]
          ?.disease_pressure_index || 0,
        current_humidity: weatherData.current.humidity.rh_mean || 0,
        current_temperature:
          weatherData.current.temperature.temp_current || 0,
        recent_rainfall: weatherData.current.rainfall.rain_amount || 0,
      },

      // WEATHER SUMMARY (Last 24 hours if available)
      weather24h: weatherData.hourly.slice(-24),

      // DAILY FORECASTS (Next 7 days)
      forecast7days: weatherData.daily.slice(0, 7),

      // CROP INFORMATION
      cropInfo: {
        crop_name: cropData.crop_name || "Unknown",
        variety: cropData.variety_hybrid || "Unknown",
        sowing_date: cropData.sowing_date || null,
        irrigation_type: cropData.irrigation_type || "rainfed",
        soil_type: cropData.soil_type || "loamy",
        season: cropData.season || "kharif",
      },

      // LOCATION
      location: {
        latitude: weatherData.location.latitude,
        longitude: weatherData.location.longitude,
        timezone: weatherData.timezone,
      },
    };

    return formatted;
  }

  /**
   * Clear cache manually
   */
  clearCache() {
    this.cache.clear();
    console.log("✓ Weather cache cleared");
  }
}

/**
 * ============================================================================
 * EXPORT & USAGE EXAMPLES
 * ============================================================================
 */

module.exports = {
  WeatherDataFetcher,
  WEATHER_PARAMETERS,
  CROP_PARAMETERS,
};

/**
 * USAGE EXAMPLE:
 *
 * const { WeatherDataFetcher } = require('./weatherFetcher');
 *
 * const fetcher = new WeatherDataFetcher({
 *   timezone: 'Asia/Kolkata',
 *   forecastDays: 10
 * });
 *
 * // Visakhapatnam coordinates
 * const lat = 16.9891;
 * const lon = 82.8537;
 *
 * // Crop data
 * const cropData = {
 *   crop_name: 'Rice',
 *   variety_hybrid: 'MTU-1001',
 *   sowing_date: '2025-07-01',
 *   irrigation_type: 'canal',
 *   soil_type: 'clay',
 *   season: 'kharif',
 *   nitrogen_applied: 120,
 *   phosphorus_applied: 60,
 *   potassium_applied: 40,
 * };
 *
 * // Get complete weather data
 * const weatherData = await fetcher.getCompleteWeatherData(lat, lon, cropData);
 *
 * // Format for disease prediction model
 * const modelInput = fetcher.formatForDiseaseModel(weatherData, cropData);
 *
 * // Use in disease prediction
 * const diseaseRisk = predictDisease(modelInput);
 */