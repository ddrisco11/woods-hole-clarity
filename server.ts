/**
 * ============================================================================
 * WOODS HOLE WATER CLARITY - SINGLE FILE BACKEND
 * ============================================================================
 * 
 * Purpose: Real-time water clarity forecasting for Woods Hole diving/snorkeling sites
 * 
 * Quick Run:
 *   npm install express cors zod node-fetch @types/express @types/cors @types/node tsx
 *   npx tsx server.ts
 * 
 * Libraries: express, cors, zod, node-fetch, tsx (for TypeScript execution)
 * 
 * Data Sources: NOAA CO-OPS (tides), NDBC (wind), OpenWeather (rain - FREE PLAN), Stormglass (waves)
 * Algorithm: Weighted penalty system scoring clarity 0-100 based on environmental factors
 * 
 * FREE PLAN COMPLIANCE:
 * - OpenWeather: Uses Current Weather API only (no hourly/daily forecasts)
 * - Rate limiting: 50 req/min (under 60/min limit), 1 call per hour refresh cycle
 */

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import fetch from 'node-fetch';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// ============================================================================
// CONFIG (LOADED FROM ENVIRONMENT VARIABLES)
// ============================================================================

// API KEYS - Loaded from .env file (create from .env.example)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || ""; // Required for precipitation data
const STORMGLASS_API_KEY = process.env.STORMGLASS_API_KEY || ""; // Optional - leave empty to disable waves
const ADMIN_SECRET = process.env.ADMIN_SECRET || ""; // Required for calibration endpoint protection

// PUBLIC API ENDPOINTS (no keys needed)
const NOAA_COOPS_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const NDBC_BASE = "https://www.ndbc.noaa.gov";

// STATION IDS (Woods Hole area)
const COOPS_STATION = "8447930"; // Woods Hole - NOAA tide station
const NDBC_STATION = "44013";    // Boston buoy - closest reliable NDBC station to Woods Hole

// LOCATION COORDINATES
const DEFAULT_COORDS = { lat: 41.523, lon: -70.671 }; // Woods Hole center

// SERVER CONFIGURATION - Can be overridden by environment variables
const PORT = parseInt(process.env.PORT || "5056");
const REFRESH_MINUTES = parseInt(process.env.REFRESH_MINUTES || "60"); // How often to refresh data from sources (60min = 1 OpenWeather call/hour, well within free plan limits)

// FORECAST SETTINGS
const MAX_FORECAST_HOURS = 72;
const TIDE_HISTORY_HOURS = 36; // How far back to fetch for derivatives

// STORMGLASS RATE LIMITING (10 requests per day limit) - Can be overridden by environment variables
const STORMGLASS_CACHE_HOURS = parseInt(process.env.STORMGLASS_CACHE_HOURS || "3"); // Cache wave data for 3 hours (8 requests/day max)
const STORMGLASS_MAX_DAILY_REQUESTS = parseInt(process.env.STORMGLASS_MAX_DAILY_REQUESTS || "8"); // Conservative limit to stay under 10/day

// OPENWEATHER RATE LIMITING (60 requests per minute limit for free plan)
const OPENWEATHER_MAX_REQUESTS_PER_MINUTE = parseInt(process.env.OPENWEATHER_MAX_REQUESTS_PER_MINUTE || "50"); // Conservative limit to stay under 60/minute

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

// Site definition with clarity-affecting characteristics
interface Site {
  id: string;
  name: string;
  lat: number;
  lon: number;
  shorelineBearingTowardShore: number; // Degrees: direction FROM sea TO shore
  exposure: number; // 0-1: how exposed to open water (affects wave impact)
  notes?: string;
}

// Model weights for clarity scoring
interface Weights {
  wWind: number;      // Wind speed penalty weight
  wOnshore: number;   // Onshore wind component penalty weight  
  wTideFlow: number;  // Tidal current penalty weight
  wRain: number;      // Recent precipitation penalty weight
  wSwell: number;     // Wave/swell penalty weight
}

// User observation of actual conditions
interface Observation {
  id: string;
  ts: string; // ISO timestamp
  siteId: string;
  secchiMeters?: number; // Secchi disk depth in meters
  clarityNote?: 'crystal' | 'good' | 'ok' | 'murky';
  photoUrl?: string;
}

// Normalized environmental data structures
interface WaterLevel {
  t: string; // ISO timestamp
  level_ft: number;
}

interface WindData {
  t: string;
  wind_dir_deg: number; // Meteorological direction (FROM)
  wind_speed_kt: number;
  gust_kt?: number;
}

interface WaveData {
  t: string;
  Hs_m: number; // Significant wave height
  Tp_s?: number; // Peak period
}

interface PrecipData {
  last72h_mm: number;
  windowed_mm: { [isoHour: string]: number };
}

// Forecast score components
interface ScoreComponents {
  wind: number;
  onshore: number;
  tideFlow: number;
  rain: number;
  swell: number;
}

interface ForecastPoint {
  t: string;
  score: number;
  components: ScoreComponents;
}

// Request/Response schemas
const ObservationRequestSchema = z.object({
  ts: z.string().optional(),
  siteId: z.string(),
  secchiMeters: z.number().min(0).optional(),
  clarityNote: z.enum(['crystal', 'good', 'ok', 'murky']).optional(),
  photoUrl: z.string().url().optional()
});

const CalibrationRequestSchema = z.object({
  wWind: z.number().min(0).optional(),
  wOnshore: z.number().min(0).optional(),
  wTideFlow: z.number().min(0).optional(),
  wRain: z.number().min(0).optional(),
  wSwell: z.number().min(0).optional()
});

// ============================================================================
// STATIC SITES ARRAY
// ============================================================================

const SITES: Site[] = [
  {
    id: "stoney-beach",
    name: "Stoney Beach",
    lat: 41.5297,
    lon: -70.6609,
    shorelineBearingTowardShore: 315, // NW - from sea toward shore
    exposure: 0.35, // Moderately sheltered
    notes: "Sheltered cove; clarity often best near high slack tide"
  },
  {
    id: "devils-foot",
    name: "Devil's Foot Island",
    lat: 41.5156,
    lon: -70.6445,
    shorelineBearingTowardShore: 90, // E - from sea toward shore  
    exposure: 0.7, // More exposed to Vineyard Sound
    notes: "Exposed site; good visibility when winds are offshore (westerly)"
  },
  {
    id: "great-harbor",
    name: "Great Harbor",
    lat: 41.5234,
    lon: -70.6712,
    shorelineBearingTowardShore: 45, // NE - from sea toward shore
    exposure: 0.25, // Well protected harbor
    notes: "Protected harbor; can be murky during rain runoff"
  },
  {
    id: "nonamesset-side",
    name: "Nonamesset Island Side",
    lat: 41.5089,
    lon: -70.6234,
    shorelineBearingTowardShore: 140, // SE - from sea toward shore
    exposure: 0.6, // Moderately exposed
    notes: "South-facing; best in northerly winds and calm seas"
  }
];

// ============================================================================
// IN-MEMORY STORES
// ============================================================================

// Model weights (initial defaults from product spec)
let weights: Weights = {
  wWind: 2.0,      // Wind speed penalty
  wOnshore: 2.5,   // Onshore wind component penalty
  wTideFlow: 1.5,  // Tidal current penalty
  wRain: 1.0,      // Precipitation penalty
  wSwell: 1.0      // Wave/swell penalty
};

// User observations storage (in-memory for v1)
let observations: Observation[] = [];

// Data cache with computed forecasts
interface Cache {
  waterLevelHourly: WaterLevel[];
  tideFlowPerTimestamp: { [isoHour: string]: number }; // ft/hr
  windLatest: WindData | null;
  precipSummary72h: PrecipData | null;
  wavesLatest: WaveData | null;
  scoreBySiteByTime: { [siteId: string]: { [isoHour: string]: ForecastPoint } };
  lastRefreshedAt: string;
  degraded: boolean;
  sources: {
    coops: boolean;
    ndbc: boolean;
    openweather: boolean;
    stormglass: boolean;
  };
}

// Stormglass-specific cache with rate limiting
interface StormglassCache {
  data: WaveData | null;
  lastFetchedAt: string | null;
  requestsToday: number;
  lastResetDate: string; // Track daily reset
}

let cache: Cache = {
  waterLevelHourly: [],
  tideFlowPerTimestamp: {},
  windLatest: null,
  precipSummary72h: null,
  wavesLatest: null,
  scoreBySiteByTime: {},
  lastRefreshedAt: new Date().toISOString(),
  degraded: false,
  sources: {
    coops: false,
    ndbc: false,
    openweather: false,
    stormglass: false
  }
};

// Separate cache for Stormglass with rate limiting
let stormglassCache: StormglassCache = {
  data: null,
  lastFetchedAt: null,
  requestsToday: 0,
  lastResetDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
};

// OpenWeather rate limiting cache
interface OpenWeatherCache {
  requestsThisMinute: number;
  lastResetMinute: string; // Track minute-based reset (YYYY-MM-DDTHH:MM format)
}

let openWeatherCache: OpenWeatherCache = {
  requestsThisMinute: 0,
  lastResetMinute: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM format
};

// ============================================================================
// UTILITIES
// ============================================================================

// Time utilities
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function toISOString(date: Date): string {
  return date.toISOString();
}

// Math utilities
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

// Unit conversions
function mpsToKnots(mps: number): number {
  return mps * 1.94384;
}

function inchesToMm(inches: number): number {
  return inches * 25.4;
}

function mmToInches(mm: number): number {
  return mm / 25.4;
}

// Onshore wind component calculation
function calculateOnshoreComponent(
  windDirDeg: number, // Meteorological direction (FROM)
  windSpeedKt: number,
  shorelineBearingTowardShore: number
): number {
  // Calculate angle between wind direction and shore-normal
  const angleDiff = normalizeAngle(windDirDeg - shorelineBearingTowardShore);
  const angleRad = degreesToRadians(angleDiff);
  
  // Only positive (onshore) component contributes to penalty
  return Math.max(0, windSpeedKt * Math.cos(angleRad));
}

// Generate hourly timestamps for forecast period
function generateHourlyTimestamps(startDate: Date, hours: number): string[] {
  const timestamps: string[] = [];
  for (let i = 0; i < hours; i++) {
    const date = new Date(startDate.getTime() + i * 60 * 60 * 1000);
    timestamps.push(toISOString(date));
  }
  return timestamps;
}

// Stormglass cache management utilities
function resetDailyRequestCountIfNeeded(): void {
  const today = new Date().toISOString().split('T')[0];
  if (stormglassCache.lastResetDate !== today) {
    stormglassCache.requestsToday = 0;
    stormglassCache.lastResetDate = today;
    console.log('Stormglass daily request count reset');
  }
}

function isStormglassCacheValid(): boolean {
  if (!stormglassCache.data || !stormglassCache.lastFetchedAt) {
    return false;
  }
  
  const cacheAge = Date.now() - new Date(stormglassCache.lastFetchedAt).getTime();
  const cacheAgeHours = cacheAge / (1000 * 60 * 60);
  
  return cacheAgeHours < STORMGLASS_CACHE_HOURS;
}

function canFetchStormglassData(): boolean {
  resetDailyRequestCountIfNeeded();
  return stormglassCache.requestsToday < STORMGLASS_MAX_DAILY_REQUESTS;
}

// OpenWeather rate limiting utilities
function resetMinuteRequestCountIfNeeded(): void {
  const currentMinute = new Date().toISOString().slice(0, 16);
  if (openWeatherCache.lastResetMinute !== currentMinute) {
    openWeatherCache.requestsThisMinute = 0;
    openWeatherCache.lastResetMinute = currentMinute;
    console.log('OpenWeather minute request count reset');
  }
}

function canFetchOpenWeatherData(): boolean {
  resetMinuteRequestCountIfNeeded();
  return openWeatherCache.requestsThisMinute < OPENWEATHER_MAX_REQUESTS_PER_MINUTE;
}

// ============================================================================
// PENALTY FUNCTIONS (DOCUMENTED)
// ============================================================================

/**
 * Wind speed penalty - increases nonlinearly after ~5 knots
 * Higher winds create surface chop and reduce visibility
 */
function fWindSpeed(speedKnots: number): number {
  if (speedKnots <= 5) return 0;
  return Math.pow(speedKnots - 5, 1.3);
}

/**
 * Onshore wind component penalty - direct proportion
 * Onshore winds push surface debris and create turbidity
 */
function fOnshore(onshoreKnots: number): number {
  return Math.max(0, onshoreKnots);
}

/**
 * Tidal flow penalty - based on rate of water level change
 * Strong currents stir up sediment and reduce clarity
 */
function fTideFlow(flowFtPerHr: number): number {
  return Math.abs(flowFtPerHr) * 2; // Scale factor for penalty
}

/**
 * Rain penalty - based on 72-hour accumulation
 * Recent rain increases runoff and turbidity
 */
function fRain(mm72h: number): number {
  return clamp(mm72h / 3, 0, 20); // Scale 0-60mm to 0-20 penalty points
}

/**
 * Swell penalty - based on wave height and period
 * Larger waves and shorter periods increase bottom disturbance
 */
function fSwell(HsMeters: number, TpSeconds?: number): number {
  const basePenalty = HsMeters * 10;
  const periodMultiplier = (TpSeconds && TpSeconds < 7) ? 1.2 : 1.0;
  return basePenalty * periodMultiplier;
}

// ============================================================================
// CORE SCORING ALGORITHM (DOCUMENTED)
// ============================================================================

/**
 * Calculate clarity score for a site at a specific time
 * Score = 100 - (weighted sum of penalties), clamped to [0,100]
 * 
 * Higher scores = better clarity conditions
 * Score of 100 = perfect conditions (no penalties)
 * Score of 0 = very poor conditions (maximum penalties)
 */
function calculateClarityScore(
  site: Site,
  windData: WindData | null,
  tideFlow: number, // ft/hr
  rain72h: number, // mm
  waveData: WaveData | null
): { score: number; components: ScoreComponents } {
  
  const components: ScoreComponents = {
    wind: 0,
    onshore: 0,
    tideFlow: 0,
    rain: 0,
    swell: 0
  };

  // Wind penalties
  if (windData) {
    components.wind = fWindSpeed(windData.wind_speed_kt);
    components.onshore = fOnshore(
      calculateOnshoreComponent(
        windData.wind_dir_deg,
        windData.wind_speed_kt,
        site.shorelineBearingTowardShore
      )
    );
  }

  // Tidal flow penalty
  components.tideFlow = fTideFlow(tideFlow);

  // Rain penalty
  components.rain = fRain(rain72h);

  // Wave penalty (scaled by site exposure)
  if (waveData) {
    components.swell = fSwell(waveData.Hs_m, waveData.Tp_s) * site.exposure;
  }

  // Calculate weighted score
  const totalPenalty = 
    weights.wWind * components.wind +
    weights.wOnshore * components.onshore +
    weights.wTideFlow * components.tideFlow +
    weights.wRain * components.rain +
    weights.wSwell * components.swell;

  const score = clamp(100 - totalPenalty, 0, 100);

  return { score, components };
}

// ============================================================================
// DATA FETCHERS (DOCUMENTED CONTRACTS)
// ============================================================================

/**
 * Fetch NOAA CO-OPS water level data (hourly)
 * Returns normalized array of water levels with timestamps
 */
async function fetchWaterLevels(): Promise<WaterLevel[]> {
  try {
    const beginDate = toISOString(hoursAgo(TIDE_HISTORY_HOURS)).slice(0, 16).replace('T', ' ');
    const endDate = toISOString(hoursFromNow(MAX_FORECAST_HOURS)).slice(0, 16).replace('T', ' ');
    
    const url = `${NOAA_COOPS_BASE}?` + new URLSearchParams({
      product: 'water_level',
      application: 'WoodsHoleClarity',
      station: COOPS_STATION,
      begin_date: beginDate,
      end_date: endDate,
      datum: 'MLLW',
      time_zone: 'lst_ldt',
      units: 'english',
      format: 'json'
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CO-OPS API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid CO-OPS response format');
    }

    return data.data.map((item: any) => ({
      t: new Date(item.t).toISOString(),
      level_ft: parseFloat(item.v)
    })).filter((item: WaterLevel) => !isNaN(item.level_ft));

  } catch (error) {
    console.error('Failed to fetch water levels:', error);
    return [];
  }
}

/**
 * Fetch NDBC wind data (latest observation)
 * Returns normalized wind data with direction and speed in knots
 */
async function fetchWindData(): Promise<WindData | null> {
  try {
    // Try multiple NDBC endpoints for better reliability
    const urls = [
      `${NDBC_BASE}/data/realtime2/${NDBC_STATION}.txt`,
      `${NDBC_BASE}/data/latest_obs/${NDBC_STATION}.txt`
    ];
    
    let response;
    let lastError;
    
    for (const url of urls) {
      try {
        console.log(`Trying NDBC URL: ${url}`);
        response = await fetch(url);
        if (response.ok) {
          break;
        }
        lastError = new Error(`NDBC API error: ${response.status} for ${url}`);
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    if (!response || !response.ok) {
      throw lastError || new Error('All NDBC endpoints failed');
    }

    const text = await response.text();
    const lines = text.trim().split('\n');
    
    if (lines.length < 3) {
      throw new Error('Invalid NDBC response format');
    }

    // Parse header and data lines
    const headers = lines[0].split(/\s+/);
    const units = lines[1].split(/\s+/);
    const values = lines[2].split(/\s+/);

    // Find relevant columns
    const wdirIdx = headers.findIndex(h => h === 'WDIR');
    const wspdIdx = headers.findIndex(h => h === 'WSPD');
    const gstIdx = headers.findIndex(h => h === 'GST');
    const timeIdx = headers.findIndex(h => h.includes('YY') || h.includes('YYYY'));

    if (wdirIdx === -1 || wspdIdx === -1) {
      throw new Error('Required wind columns not found');
    }

    const windDir = parseFloat(values[wdirIdx]);
    let windSpeed = parseFloat(values[wspdIdx]);
    const gust = gstIdx !== -1 ? parseFloat(values[gstIdx]) : undefined;

    // Check if values are valid
    if (isNaN(windDir) || isNaN(windSpeed)) {
      throw new Error('Invalid wind data values');
    }

    // Convert m/s to knots if needed (detect by checking typical ranges)
    if (windSpeed < 30 && units[wspdIdx] === 'm/s') {
      windSpeed = mpsToKnots(windSpeed);
    }

    return {
      t: new Date().toISOString(), // Use current time for latest obs
      wind_dir_deg: windDir,
      wind_speed_kt: windSpeed,
      gust_kt: gust && !isNaN(gust) ? (units[gstIdx] === 'm/s' ? mpsToKnots(gust) : gust) : undefined
    };

  } catch (error) {
    console.error('Failed to fetch wind data:', error);
    return null;
  }
}

/**
 * Fetch OpenWeather precipitation data (FREE PLAN COMPATIBLE)
 * Uses Current Weather API only - no hourly/daily forecasts available in free plan
 * Returns current precipitation data only
 */
async function fetchPrecipitationData(): Promise<PrecipData | null> {
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY.trim() === "") {
    console.log('OpenWeather API key not configured, skipping precipitation data');
    return null;
  }

  // Check rate limiting (60 requests per minute for free plan)
  if (!canFetchOpenWeatherData()) {
    console.warn(`OpenWeather rate limit reached (${openWeatherCache.requestsThisMinute}/${OPENWEATHER_MAX_REQUESTS_PER_MINUTE} requests this minute). Skipping request.`);
    return null;
  }

  try {
    console.log(`Fetching OpenWeather data (request ${openWeatherCache.requestsThisMinute + 1}/${OPENWEATHER_MAX_REQUESTS_PER_MINUTE} this minute)`);
    
    // Use Current Weather API (free plan compatible)
    // Note: Free plan does NOT include hourly/daily forecasts or historical data
    const url = `https://api.openweathermap.org/data/2.5/weather?` + new URLSearchParams({
      lat: DEFAULT_COORDS.lat.toString(),
      lon: DEFAULT_COORDS.lon.toString(),
      appid: OPENWEATHER_API_KEY,
      units: 'metric'
    });

    const response = await fetch(url);
    
    // Increment request counter immediately after making request
    openWeatherCache.requestsThisMinute++;
    
    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status}`);
    }

    const data = await response.json() as any;

    // Free plan only provides current conditions, not historical or forecast data
    // We can only get current rain/snow if it's actively happening
    const currentRain = data.rain?.['1h'] || data.rain?.['3h'] || 0;
    const currentSnow = data.snow?.['1h'] || data.snow?.['3h'] || 0;
    const currentPrecip = currentRain + currentSnow;

    // Since we can't get 72h history with free plan, we'll use a simplified approach
    // This is a limitation of the free plan - we can only see current precipitation
    const windowed: { [isoHour: string]: number } = {};
    const currentTime = new Date().toISOString();
    windowed[currentTime] = currentPrecip;

    console.log(`OpenWeather (FREE PLAN): Current precipitation: ${currentPrecip}mm`);

    return {
      last72h_mm: currentPrecip, // Limited to current conditions only
      windowed_mm: windowed
    };

  } catch (error) {
    console.error('Failed to fetch precipitation data:', error);
    return null;
  }
}

/**
 * Fetch Stormglass wave data with intelligent caching (10 requests/day limit)
 * Returns wave height and period data if API key is configured
 * Uses aggressive caching to stay within rate limits
 */
async function fetchWaveData(): Promise<WaveData | null> {
  if (!STORMGLASS_API_KEY || STORMGLASS_API_KEY.trim() === "") {
    console.log('Stormglass API key not configured, skipping wave data');
    return null;
  }

  // Check if cached data is still valid
  if (isStormglassCacheValid()) {
    console.log(`Using cached Stormglass data (age: ${Math.round((Date.now() - new Date(stormglassCache.lastFetchedAt!).getTime()) / (1000 * 60))} minutes)`);
    return stormglassCache.data;
  }

  // Check if we can make a new request (rate limiting)
  if (!canFetchStormglassData()) {
    console.warn(`Stormglass rate limit reached (${stormglassCache.requestsToday}/${STORMGLASS_MAX_DAILY_REQUESTS} requests today). Using cached data.`);
    return stormglassCache.data; // Return cached data even if stale
  }

  try {
    console.log(`Fetching fresh Stormglass data (request ${stormglassCache.requestsToday + 1}/${STORMGLASS_MAX_DAILY_REQUESTS} today)`);
    
    const url = `https://api.stormglass.io/v2/weather/point?` + new URLSearchParams({
      lat: DEFAULT_COORDS.lat.toString(),
      lng: DEFAULT_COORDS.lon.toString(),
      params: 'waveHeight,wavePeriod'
    });

    const response = await fetch(url, {
      headers: {
        'Authorization': STORMGLASS_API_KEY
      }
    });

    // Increment request counter immediately after making request
    stormglassCache.requestsToday++;

    if (!response.ok) {
      throw new Error(`Stormglass API error: ${response.status}`);
    }

    const data = await response.json() as any;

    if (!data.hours || !Array.isArray(data.hours) || data.hours.length === 0) {
      throw new Error('No wave data available');
    }

    // Use the most recent data point
    const latest = data.hours[0];
    
    const waveData: WaveData = {
      t: new Date(latest.time).toISOString(),
      Hs_m: latest.waveHeight?.sg || 0,
      Tp_s: latest.wavePeriod?.sg
    };

    // Update cache with fresh data
    stormglassCache.data = waveData;
    stormglassCache.lastFetchedAt = new Date().toISOString();

    console.log(`Stormglass data cached successfully. Hs=${waveData.Hs_m}m, Tp=${waveData.Tp_s}s`);
    return waveData;

  } catch (error) {
    console.error('Failed to fetch wave data:', error);
    
    // Return cached data if available, even if stale
    if (stormglassCache.data) {
      console.log('Returning stale cached Stormglass data due to fetch error');
      return stormglassCache.data;
    }
    
    return null;
  }
}

// ============================================================================
// COMPUTE FORECAST TABLE
// ============================================================================

/**
 * Compute tidal flow rates from water level data
 * Flow = |Δlevel| / Δtime (ft/hr)
 */
function computeTideFlow(waterLevels: WaterLevel[]): { [isoHour: string]: number } {
  const tideFlow: { [isoHour: string]: number } = {};
  
  for (let i = 1; i < waterLevels.length; i++) {
    const current = waterLevels[i];
    const previous = waterLevels[i - 1];
    
    const timeDiffHours = (new Date(current.t).getTime() - new Date(previous.t).getTime()) / (1000 * 60 * 60);
    const levelDiff = Math.abs(current.level_ft - previous.level_ft);
    
    if (timeDiffHours > 0) {
      tideFlow[current.t] = levelDiff / timeDiffHours;
    }
  }
  
  return tideFlow;
}

/**
 * Build forecast table for all sites and time windows
 */
function computeForecastTable(hours: number = MAX_FORECAST_HOURS): void {
  const now = new Date();
  const timestamps = generateHourlyTimestamps(now, hours);
  
  // Reset forecast table
  cache.scoreBySiteByTime = {};
  
  for (const site of SITES) {
    cache.scoreBySiteByTime[site.id] = {};
    
    for (const timestamp of timestamps) {
      // Get environmental conditions for this hour
      const tideFlow = cache.tideFlowPerTimestamp[timestamp] || 0;
      const rain72h = cache.precipSummary72h?.last72h_mm || 0;
      
      // Calculate clarity score
      const result = calculateClarityScore(
        site,
        cache.windLatest,
        tideFlow,
        rain72h,
        cache.wavesLatest
      );
      
      cache.scoreBySiteByTime[site.id][timestamp] = {
        t: timestamp,
        score: result.score,
        components: result.components
      };
    }
  }
}

/**
 * Find best time windows for a site
 */
function findBestWindows(siteId: string, hours: number, windowSizeHours: number = 2): Array<{start: string, end: string, avgScore: number}> {
  const siteData = cache.scoreBySiteByTime[siteId];
  if (!siteData) return [];
  
  const timestamps = Object.keys(siteData).sort().slice(0, hours);
  const windows: Array<{start: string, end: string, avgScore: number}> = [];
  
  for (let i = 0; i <= timestamps.length - windowSizeHours; i++) {
    const windowTimestamps = timestamps.slice(i, i + windowSizeHours);
    const scores = windowTimestamps.map(t => siteData[t]?.score || 0);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    windows.push({
      start: windowTimestamps[0],
      end: windowTimestamps[windowTimestamps.length - 1],
      avgScore: Math.round(avgScore * 10) / 10
    });
  }
  
  return windows.sort((a, b) => b.avgScore - a.avgScore);
}

// ============================================================================
// REFRESH SCHEDULER
// ============================================================================

/**
 * Fetch all data sources and recompute forecasts
 */
async function refreshAllData(): Promise<void> {
  console.log('Refreshing data from all sources...');
  
  const startTime = Date.now();
  let degraded = false;
  
  // Fetch all sources in parallel
  const [waterLevels, windData, precipData, waveData] = await Promise.all([
    fetchWaterLevels(),
    fetchWindData(),
    fetchPrecipitationData(),
    fetchWaveData()
  ]);
  
  // Update cache with new data
  cache.waterLevelHourly = waterLevels;
  cache.windLatest = windData;
  cache.precipSummary72h = precipData;
  cache.wavesLatest = waveData; // This now comes from intelligent cache
  
  // Compute derived data
  cache.tideFlowPerTimestamp = computeTideFlow(waterLevels);
  
  // Update source status
  cache.sources = {
    coops: waterLevels.length > 0,
    ndbc: windData !== null,
    openweather: precipData !== null,
    stormglass: waveData !== null
  };
  
  // Check if any critical sources failed
  if (!cache.sources.coops || !cache.sources.ndbc) {
    degraded = true;
    console.warn('Critical data sources unavailable - operating in degraded mode');
  }
  
  // Recompute forecast table
  computeForecastTable();
  
  // Update cache metadata
  cache.lastRefreshedAt = new Date().toISOString();
  cache.degraded = degraded;
  
  const duration = Date.now() - startTime;
  console.log(`Data refresh completed in ${duration}ms - tides=${waterLevels.length}h, wind=${windData ? 'OK' : 'FAIL'}, rain=${precipData ? 'OK' : 'SKIP'}, waves=${waveData ? 'OK' : 'SKIP'}`);
}

/**
 * Start periodic refresh scheduler
 */
function startRefreshScheduler(): void {
  // Initial refresh on startup
  refreshAllData().catch(error => {
    console.error('Initial data refresh failed:', error);
    cache.degraded = true;
  });
  
  // Schedule periodic refreshes
  setInterval(() => {
    refreshAllData().catch(error => {
      console.error('Scheduled data refresh failed:', error);
      cache.degraded = true;
    });
  }, REFRESH_MINUTES * 60 * 1000);
  
  console.log(`Refresh scheduler started - updating every ${REFRESH_MINUTES} minutes`);
}

// ============================================================================
// HTTP API (EXPRESS)
// ============================================================================

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Add your frontend origins
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================================

app.get('/health', (req, res) => {
  resetDailyRequestCountIfNeeded(); // Update daily counter
  resetMinuteRequestCountIfNeeded(); // Update minute counter
  
  res.json({
    ok: true,
    lastRefreshedAt: cache.lastRefreshedAt,
    degraded: cache.degraded,
    sources: cache.sources,
    openweather: {
      enabled: !!OPENWEATHER_API_KEY && OPENWEATHER_API_KEY.trim() !== "",
      requestsThisMinute: openWeatherCache.requestsThisMinute,
      maxRequestsPerMinute: OPENWEATHER_MAX_REQUESTS_PER_MINUTE,
      lastResetMinute: openWeatherCache.lastResetMinute,
      freePlanLimitations: "Current weather only - no hourly/daily forecasts or historical data"
    },
    stormglass: {
      enabled: !!STORMGLASS_API_KEY && STORMGLASS_API_KEY.trim() !== "",
      requestsToday: stormglassCache.requestsToday,
      maxDailyRequests: STORMGLASS_MAX_DAILY_REQUESTS,
      cacheValid: isStormglassCacheValid(),
      lastFetchedAt: stormglassCache.lastFetchedAt,
      cacheAgeMinutes: stormglassCache.lastFetchedAt ? 
        Math.round((Date.now() - new Date(stormglassCache.lastFetchedAt).getTime()) / (1000 * 60)) : null
    }
  });
});

// ============================================================================
// CORE DATA ENDPOINTS
// ============================================================================

app.get('/sites', (req, res) => {
  res.json(SITES);
});

app.get('/now', (req, res) => {
  const now = new Date().toISOString();
  const sites: any[] = [];
  let bestSiteNow = { siteId: '', score: 0, reason: '' };
  
  for (const site of SITES) {
    const siteData = cache.scoreBySiteByTime[site.id];
    if (!siteData) continue;
    
    // Find current hour score
    const currentHour = new Date().toISOString().slice(0, 13) + ':00:00.000Z';
    const currentScore = siteData[currentHour]?.score || 0;
    
    // Calculate trend over next 6 hours
    const next6Hours = generateHourlyTimestamps(new Date(), 6);
    const scores6h = next6Hours.map(t => siteData[t]?.score || 0);
    const trend = scores6h.length > 1 ? 
      (scores6h[scores6h.length - 1] - scores6h[0] > 5 ? 'rising' : 
       scores6h[scores6h.length - 1] - scores6h[0] < -5 ? 'falling' : 'flat') : 'flat';
    
    // Determine tide phase
    const currentFlow = cache.tideFlowPerTimestamp[currentHour] || 0;
    const tidePhase = currentFlow < 0.5 ? 'slack' : currentFlow > 1.5 ? 'strong-flow' : 'moderate-flow';
    
    // Find best window today (remaining hours)
    const hoursRemaining = 24 - new Date().getHours();
    const bestWindows = findBestWindows(site.id, hoursRemaining, 2);
    const bestWindowToday = bestWindows[0] || null;
    
    // Build onshore component for display
    let onshoreKt = 0;
    if (cache.windLatest) {
      onshoreKt = calculateOnshoreComponent(
        cache.windLatest.wind_dir_deg,
        cache.windLatest.wind_speed_kt,
        site.shorelineBearingTowardShore
      );
    }
    
    const siteNow = {
      siteId: site.id,
      currentScore: Math.round(currentScore),
      trendNext6h: trend,
      tidePhase,
      wind: cache.windLatest ? {
        t: cache.windLatest.t,
        dirDeg: cache.windLatest.wind_dir_deg,
        speedKt: Math.round(cache.windLatest.wind_speed_kt * 10) / 10,
        onshoreKt: Math.round(onshoreKt * 10) / 10
      } : null,
      rain: cache.precipSummary72h ? {
        last72h_mm: Math.round(cache.precipSummary72h.last72h_mm * 10) / 10
      } : null,
      waves: cache.wavesLatest ? {
        Hs_m: Math.round(cache.wavesLatest.Hs_m * 10) / 10,
        Tp_s: cache.wavesLatest.Tp_s
      } : null,
      bestWindowToday
    };
    
    sites.push(siteNow);
    
    // Track best site overall
    if (currentScore > bestSiteNow.score) {
      bestSiteNow = {
        siteId: site.id,
        score: Math.round(currentScore),
        reason: currentScore > 80 ? 'Excellent conditions' : 
                currentScore > 60 ? 'Good conditions' : 'Fair conditions'
      };
    }
  }
  
  res.json({
    generatedAt: now,
    bestSiteNow,
    sites,
    degraded: cache.degraded
  });
});

app.get('/forecast', (req, res) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 48, MAX_FORECAST_HOURS);
  const sites: { [siteId: string]: ForecastPoint[] } = {};
  
  const timestamps = generateHourlyTimestamps(new Date(), hours);
  
  for (const site of SITES) {
    const siteData = cache.scoreBySiteByTime[site.id];
    if (!siteData) continue;
    
    sites[site.id] = timestamps.map(t => siteData[t]).filter(Boolean);
  }
  
  res.json({
    hours,
    sites
  });
});

app.get('/sites/:id/forecast', (req, res) => {
  const siteId = req.params.id;
  const hours = Math.min(parseInt(req.query.hours as string) || 48, MAX_FORECAST_HOURS);
  
  const site = SITES.find(s => s.id === siteId);
  if (!site) {
    return res.status(404).json({ error: { message: 'Site not found' } });
  }
  
  const siteData = cache.scoreBySiteByTime[siteId];
  if (!siteData) {
    return res.status(503).json({ error: { message: 'Forecast data not available' } });
  }
  
  const timestamps = generateHourlyTimestamps(new Date(), hours);
  const forecast = timestamps.map(t => siteData[t]).filter(Boolean);
  
  // Find best windows
  const bestWindows = findBestWindows(siteId, hours, 2).slice(0, 3);
  
  res.json({
    site,
    forecast,
    bestWindows
  });
});

app.get('/rankings', (req, res) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 24, MAX_FORECAST_HOURS);
  const rankings: any[] = [];
  
  for (const site of SITES) {
    const bestWindows = findBestWindows(site.id, hours, 2);
    const top3 = bestWindows.slice(0, 3);
    
    rankings.push({
      siteId: site.id,
      bestWindow: bestWindows[0] || null,
      top3
    });
  }
  
  // Sort by best window score
  rankings.sort((a, b) => (b.bestWindow?.avgScore || 0) - (a.bestWindow?.avgScore || 0));
  
  res.json(rankings);
});

// ============================================================================
// DEBUG RAW DATA ENDPOINTS
// ============================================================================

app.get('/raw/tides', (req, res) => {
  res.json({
    waterLevels: cache.waterLevelHourly,
    tideFlow: cache.tideFlowPerTimestamp
  });
});

app.get('/raw/wind', (req, res) => {
  res.json(cache.windLatest);
});

app.get('/raw/rain', (req, res) => {
  res.json(cache.precipSummary72h);
});

app.get('/raw/waves', (req, res) => {
  res.json({
    current: cache.wavesLatest,
    cache: {
      data: stormglassCache.data,
      lastFetchedAt: stormglassCache.lastFetchedAt,
      requestsToday: stormglassCache.requestsToday,
      maxDailyRequests: STORMGLASS_MAX_DAILY_REQUESTS,
      cacheValid: isStormglassCacheValid(),
      cacheAgeMinutes: stormglassCache.lastFetchedAt ? 
        Math.round((Date.now() - new Date(stormglassCache.lastFetchedAt).getTime()) / (1000 * 60)) : null
    }
  });
});

// ============================================================================
// OBSERVATIONS ENDPOINTS
// ============================================================================

app.post('/observations', (req, res) => {
  try {
    const validatedData = ObservationRequestSchema.parse(req.body);
    
    // Validate site exists
    const site = SITES.find(s => s.id === validatedData.siteId);
    if (!site) {
      return res.status(400).json({ 
        error: { message: 'Invalid siteId', details: 'Site not found' } 
      });
    }
    
    // Create observation
    const observation: Observation = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ts: validatedData.ts || new Date().toISOString(),
      siteId: validatedData.siteId,
      secchiMeters: validatedData.secchiMeters,
      clarityNote: validatedData.clarityNote,
      photoUrl: validatedData.photoUrl
    };
    
    // Store observation
    observations.unshift(observation); // Add to beginning for newest-first
    
    // Keep only last 1000 observations to prevent memory issues
    if (observations.length > 1000) {
      observations = observations.slice(0, 1000);
    }
    
    res.json({
      saved: true,
      observation
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { message: 'Validation error', details: error.errors }
      });
    }
    
    console.error('Error saving observation:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

app.get('/observations', (req, res) => {
  const siteId = req.query.siteId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  
  let filtered = observations;
  
  if (siteId) {
    filtered = observations.filter(obs => obs.siteId === siteId);
  }
  
  res.json(filtered.slice(0, limit));
});

// ============================================================================
// CALIBRATION ENDPOINTS
// ============================================================================

app.get('/calibration', (req, res) => {
  res.json({ weights });
});

app.post('/calibration', (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  
  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: { message: 'Unauthorized', details: 'Valid x-admin-secret header required' }
    });
  }
  
  try {
    const validatedData = CalibrationRequestSchema.parse(req.body);
    
    // Update weights (merge with existing)
    weights = { ...weights, ...validatedData };
    
    // Recompute forecasts immediately
    computeForecastTable();
    
    console.log('Weights updated:', weights);
    
    res.json({
      updated: true,
      weights
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { message: 'Validation error', details: error.errors }
      });
    }
    
    console.error('Error updating calibration:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Manual refresh endpoint (admin only)
app.post('/admin/refresh', async (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  
  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: { message: 'Unauthorized', details: 'Valid x-admin-secret header required' }
    });
  }
  
  try {
    await refreshAllData();
    res.json({
      refreshed: true,
      lastRefreshedAt: cache.lastRefreshedAt,
      degraded: cache.degraded
    });
  } catch (error) {
    console.error('Manual refresh failed:', error);
    res.status(500).json({
      error: { message: 'Refresh failed', details: error.message }
    });
  }
});

// Force Stormglass refresh endpoint (admin only) - use sparingly!
app.post('/admin/stormglass/refresh', async (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  
  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: { message: 'Unauthorized', details: 'Valid x-admin-secret header required' }
    });
  }
  
  if (!canFetchStormglassData()) {
    return res.status(429).json({
      error: { 
        message: 'Rate limit exceeded', 
        details: `Already made ${stormglassCache.requestsToday}/${STORMGLASS_MAX_DAILY_REQUESTS} requests today` 
      }
    });
  }
  
  try {
    // Force cache invalidation
    stormglassCache.lastFetchedAt = null;
    
    const waveData = await fetchWaveData();
    res.json({
      refreshed: true,
      data: waveData,
      requestsToday: stormglassCache.requestsToday,
      maxDailyRequests: STORMGLASS_MAX_DAILY_REQUESTS
    });
  } catch (error) {
    console.error('Manual Stormglass refresh failed:', error);
    res.status(500).json({
      error: { message: 'Stormglass refresh failed', details: error.message }
    });
  }
});

// ============================================================================
// ERROR HANDLING & 404
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: { message: 'Endpoint not found' }
  });
});

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: { message: 'Internal server error' }
  });
});

// ============================================================================
// STARTUP
// ============================================================================

async function startServer(): Promise<void> {
  // Validate required configuration
  if (!ADMIN_SECRET || ADMIN_SECRET.trim() === "") {
    console.error('❌ ADMIN_SECRET is required but not set. Please set it in your .env file.');
    console.error('   Admin endpoints will not work without this secret.');
  }
  
  // Start refresh scheduler
  startRefreshScheduler();
  
  // Start HTTP server
  app.listen(PORT, () => {
    console.log('============================================================================');
    console.log('🌊 WOODS HOLE WATER CLARITY SERVER STARTED');
    console.log('============================================================================');
    console.log(`Server running on port ${PORT}`);
    console.log(`Refresh interval: ${REFRESH_MINUTES} minutes`);
    console.log('');
    console.log('Data Sources:');
    console.log(`  NOAA CO-OPS (tides): ${COOPS_STATION} - ${NOAA_COOPS_BASE}`);
    console.log(`  NDBC (wind): ${NDBC_STATION} - ${NDBC_BASE}`);
    const openWeatherEnabled = OPENWEATHER_API_KEY.trim() !== '';
    console.log(`  OpenWeather (rain): ${openWeatherEnabled ? `ENABLED (FREE PLAN - ${OPENWEATHER_MAX_REQUESTS_PER_MINUTE} req/min, current weather only)` : 'DISABLED - SET OPENWEATHER_API_KEY'}`);
    const stormglassEnabled = STORMGLASS_API_KEY.trim() !== '' && STORMGLASS_API_KEY;
    console.log(`  Stormglass (waves): ${stormglassEnabled ? `ENABLED (${STORMGLASS_MAX_DAILY_REQUESTS} req/day, ${STORMGLASS_CACHE_HOURS}h cache)` : 'DISABLED'}`);
    console.log('');
    console.log(`Sites configured: ${SITES.length}`);
    console.log(`Max forecast hours: ${MAX_FORECAST_HOURS}`);
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET  /health - Server status');
    console.log('  GET  /sites - Site definitions');
    console.log('  GET  /now - Current conditions');
    console.log('  GET  /forecast?hours=48 - Hourly forecasts');
    console.log('  GET  /rankings?hours=24 - Best sites/times');
    console.log('  POST /observations - Submit observations');
    console.log('  GET  /calibration - Model weights');
    console.log('  POST /calibration - Update weights (admin)');
    console.log('  POST /admin/refresh - Force data refresh (admin)');
    console.log('  POST /admin/stormglass/refresh - Force wave refresh (admin)');
    console.log('============================================================================');
    
    // Wait a moment for initial refresh to complete
    setTimeout(() => {
      const siteCount = Object.keys(cache.scoreBySiteByTime).length;
      const hourCount = siteCount > 0 ? Object.keys(cache.scoreBySiteByTime[SITES[0].id] || {}).length : 0;
      console.log(`✅ Initial data loaded: ${siteCount} sites × ${hourCount} hours, degraded=${cache.degraded}`);
    }, 5000);
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
