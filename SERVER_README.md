# Woods Hole Water Clarity Backend

A single-file backend server that provides real-time water clarity forecasting for Woods Hole diving and snorkeling sites.

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit with your API keys
   nano .env
   ```
   
   Set these variables in your `.env` file:
   - `OPENWEATHER_API_KEY` - Required for precipitation data
   - `STORMGLASS_API_KEY` - Optional for wave data (leave empty to disable)
   - `ADMIN_SECRET` - Required for calibration endpoint protection

3. **Start the server:**
   ```bash
   npm run server
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run server:dev
   ```

4. **Verify it's working:**
   - Visit `http://localhost:5056/health` in your browser
   - Should return JSON with server status

> 📖 **See [SETUP.md](SETUP.md) for detailed setup instructions and security information.**

## API Endpoints

### Core Data
- `GET /health` - Server status and data source availability
- `GET /sites` - Available diving/snorkeling sites
- `GET /now` - Current conditions for all sites
- `GET /forecast?hours=48` - Hourly forecasts for all sites
- `GET /sites/:id/forecast?hours=48` - Detailed forecast for specific site
- `GET /rankings?hours=24` - Best sites and time windows ranked

### User Data
- `POST /observations` - Submit water clarity observations
- `GET /observations?siteId=...` - Retrieve observations

### Admin (requires x-admin-secret header)
- `GET /calibration` - Current model weights
- `POST /calibration` - Update model weights
- `POST /admin/refresh` - Force data refresh
- `POST /admin/stormglass/refresh` - Force Stormglass refresh (use sparingly!)

### Debug
- `GET /raw/tides` - Raw tide data
- `GET /raw/wind` - Raw wind data  
- `GET /raw/rain` - Raw precipitation data
- `GET /raw/waves` - Raw wave data

## Data Sources

The server integrates with these public APIs:

1. **NOAA CO-OPS** (tides) - Station 8447930 (Woods Hole)
2. **NDBC** (wind) - Station BZBM3 (WHOI dock)
3. **OpenWeather** (precipitation) - Requires API key
4. **Stormglass** (waves) - Optional, requires API key, intelligently cached (10 req/day limit)

## Algorithm

The clarity scoring algorithm uses a weighted penalty system:

- **Base Score**: 100 (perfect conditions)
- **Wind Penalty**: Increases nonlinearly after ~5 knots
- **Onshore Wind Penalty**: Based on wind component toward shore
- **Tidal Flow Penalty**: Based on rate of water level change
- **Rain Penalty**: Based on 72-hour precipitation accumulation
- **Wave Penalty**: Based on wave height and period, scaled by site exposure

Final score = 100 - (weighted sum of penalties), clamped to [0,100]

## Configuration

Configuration is loaded from environment variables (`.env` file):

```bash
# .env file (create from .env.example)
OPENWEATHER_API_KEY=your_openweather_key_here
STORMGLASS_API_KEY=your_stormglass_key_here
ADMIN_SECRET=your_strong_admin_secret

# Optional server configuration
PORT=5056
REFRESH_MINUTES=60
STORMGLASS_CACHE_HOURS=3
STORMGLASS_MAX_DAILY_REQUESTS=8
```

**Security**: API keys are never stored in source code, making it safe to commit to GitHub.

## Stormglass Rate Limiting

The server implements intelligent caching for Stormglass wave data to stay within the 10 requests per day limit:

- **Cache Duration**: 3 hours per request (allows 8 requests/day maximum)
- **Daily Reset**: Request counter resets at midnight
- **Graceful Degradation**: Uses stale cached data if rate limit is reached
- **Admin Override**: Force refresh endpoint available (use sparingly!)
- **Status Monitoring**: `/health` endpoint shows cache status and request count

## Site Definitions

The server includes 4 pre-configured Woods Hole area sites:

1. **Stoney Beach** - Sheltered cove, best at high slack
2. **Devil's Foot Island** - Exposed site, good in westerly winds
3. **Great Harbor** - Protected harbor, can be murky after rain
4. **Nonamesset Island Side** - South-facing, best in northerly winds

Each site has:
- GPS coordinates
- `shorelineBearingTowardShore` - Direction from sea toward shore (degrees)
- `exposure` - How exposed to open water (0-1 scale)

## Error Handling

- **Graceful degradation**: If data sources fail, server continues with cached data
- **Status indicators**: `/health` endpoint shows which sources are working
- **Validation**: All inputs validated with Zod schemas
- **Rate limiting**: Basic protection on POST endpoints

## Development Notes

- **In-memory storage**: No database required for v1
- **TypeScript**: Fully typed with runtime validation
- **CORS enabled**: Configured for common frontend ports
- **Logging**: Comprehensive request and error logging
- **Hot reload**: Use `npm run server:dev` for development

## Future Enhancements

Comments in the code indicate areas for future improvement:
- Database integration for observations
- Hourly wind forecasts
- Machine learning calibration
- CSV export for analysis
