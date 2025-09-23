# Woods Hole Water Clarity - Setup Guide

## 🔐 Secure Setup for GitHub

This project uses environment variables to protect API keys and secrets. Follow these steps to set up the server securely.

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- API keys (optional but recommended)

## 🚀 Quick Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd woods-hole-clarity
npm install
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your actual API keys
nano .env  # or use your preferred editor
```

### 3. Get API Keys (Optional but Recommended)

#### OpenWeather API (Free - Recommended)
1. Visit https://openweathermap.org/api
2. Sign up for a free account
3. Get your API key
4. Add to `.env`: `OPENWEATHER_API_KEY=your_key_here`

#### Stormglass API (Paid - Optional)
1. Visit https://stormglass.io/
2. Sign up for an account
3. Get your API key
4. Add to `.env`: `STORMGLASS_API_KEY=your_key_here`

#### Admin Secret (Required for Admin Features)
1. Generate a strong password/secret
2. Add to `.env`: `ADMIN_SECRET=your_strong_secret_here`

### 4. Start the Server

```bash
# Development mode (auto-restart on changes)
npm run server:dev

# Production mode
npm run server
```

### 5. Verify Setup

Visit http://localhost:5056/health to check server status.

## 📁 File Structure

```
woods-hole-clarity/
├── .env.example          # Template for environment variables
├── .env                  # Your actual secrets (NOT in git)
├── .gitignore           # Protects .env from being committed
├── server.ts            # Main server file
├── package.json         # Dependencies
└── SETUP.md            # This file
```

## 🔒 Security Features

### Environment Variables
- **API keys** are loaded from `.env` file
- **No secrets** in source code
- **Safe to commit** to GitHub

### Git Protection
- `.env` file is in `.gitignore`
- Only `.env.example` is committed
- Secrets never leave your machine

### Admin Protection
- Admin endpoints require `ADMIN_SECRET`
- Passed via `x-admin-secret` header
- Prevents unauthorized access

## 🌐 Environment Variables Reference

### Required for Full Functionality
```bash
# OpenWeather API (precipitation data)
OPENWEATHER_API_KEY=your_openweather_key

# Admin secret (for calibration endpoints)
ADMIN_SECRET=your_strong_secret_password
```

### Optional
```bash
# Stormglass API (wave data) - leave empty to disable
STORMGLASS_API_KEY=your_stormglass_key

# Server configuration (defaults shown)
PORT=5056
REFRESH_MINUTES=60
STORMGLASS_CACHE_HOURS=3
STORMGLASS_MAX_DAILY_REQUESTS=8
```

## 🧪 Testing Without API Keys

The server works without API keys:
- **Tides and wind** work (public APIs)
- **Rain and waves** will be disabled
- **Scoring still works** with available data

## 🔧 Admin Endpoints Usage

With `ADMIN_SECRET` set, you can use admin endpoints:

```bash
# Update model weights
curl -X POST http://localhost:5056/calibration \
  -H "x-admin-secret: your_admin_secret" \
  -H "Content-Type: application/json" \
  -d '{"wWind": 2.5}'

# Force data refresh
curl -X POST http://localhost:5056/admin/refresh \
  -H "x-admin-secret: your_admin_secret"
```

## 🚨 Troubleshooting

### Server won't start
- Check if `.env` file exists
- Verify Node.js version (v16+)
- Run `npm install` to install dependencies

### API keys not working
- Check `.env` file format (no quotes needed)
- Verify API keys are valid
- Check server logs for error messages

### Admin endpoints return 401
- Verify `ADMIN_SECRET` is set in `.env`
- Check `x-admin-secret` header in requests
- Ensure secret matches exactly

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5056/health
```

Returns status of all data sources and API keys.

### Logs
Server logs show:
- Which APIs are enabled/disabled
- Data refresh status
- Rate limiting information
- Error messages

## 🔄 Deployment

### Development
```bash
npm run server:dev  # Auto-restart on changes
```

### Production
```bash
npm run server      # Standard mode
```

### Environment-Specific Configs
Create different `.env` files:
- `.env.development`
- `.env.production`
- `.env.test`

## 🛡️ Security Best Practices

1. **Never commit `.env`** - Always in `.gitignore`
2. **Use strong admin secrets** - Random, long passwords
3. **Rotate secrets regularly** - Change periodically
4. **Limit API key permissions** - Use read-only keys when possible
5. **Monitor usage** - Check `/health` endpoint regularly

## 📞 Support

If you encounter issues:
1. Check server logs for error messages
2. Verify `.env` file configuration
3. Test with `/health` endpoint
4. Check API key validity and limits
