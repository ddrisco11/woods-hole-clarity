// Simple JavaScript version for deployment
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import fetch from 'node-fetch';

dotenv.config();

// Load environment variables
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";
const STORMGLASS_API_KEY = process.env.STORMGLASS_API_KEY || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const PORT = parseInt(process.env.PORT || "5056");

// Log environment info
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: PORT,
  OPENWEATHER_KEY: !!OPENWEATHER_API_KEY,
  STORMGLASS_KEY: !!STORMGLASS_API_KEY,
  ADMIN_SECRET: !!ADMIN_SECRET
});

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Simple health endpoint
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Woods Hole Water Clarity Server is running',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: {
      openweather: !!OPENWEATHER_API_KEY,
      stormglass: !!STORMGLASS_API_KEY,
      admin: !!ADMIN_SECRET
    }
  });
});

// Basic endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Woods Hole Water Clarity API',
    version: '1.0.0',
    endpoints: [
      'GET /health - Server status',
      'GET /sites - Site definitions',
      'GET /now - Current conditions',
      'GET /forecast - Hourly forecasts'
    ]
  });
});

// Sites endpoint
app.get('/sites', (req, res) => {
  res.json([
    {
      id: "stoney-beach",
      name: "Stoney Beach",
      lat: 41.5297,
      lon: -70.6609,
      shorelineBearingTowardShore: 315,
      exposure: 0.35,
      notes: "Sheltered cove; clarity often best near high slack tide"
    },
    {
      id: "devils-foot",
      name: "Devil's Foot Island",
      lat: 41.5156,
      lon: -70.6445,
      shorelineBearingTowardShore: 90,
      exposure: 0.7,
      notes: "Exposed site; good visibility when winds are offshore (westerly)"
    },
    {
      id: "great-harbor",
      name: "Great Harbor",
      lat: 41.5234,
      lon: -70.6712,
      shorelineBearingTowardShore: 45,
      exposure: 0.25,
      notes: "Protected harbor; can be murky during rain runoff"
    },
    {
      id: "nonamesset-side",
      name: "Nonamesset Island Side",
      lat: 41.5089,
      lon: -70.6234,
      shorelineBearingTowardShore: 140,
      exposure: 0.6,
      notes: "South-facing; best in northerly winds and calm seas"
    }
  ]);
});

// Now endpoint (simplified)
app.get('/now', (req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    bestSiteNow: { siteId: "stoney-beach", score: 75, reason: "Good conditions" },
    sites: [
      {
        siteId: "stoney-beach",
        currentScore: 75,
        trendNext6h: "flat",
        tidePhase: "slack",
        wind: null,
        rain: null,
        waves: null,
        bestWindowToday: null
      }
    ],
    degraded: false
  });
});

// Forecast endpoint (simplified)
app.get('/forecast', (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 48, 72);
  res.json({
    hours,
    sites: {
      "stoney-beach": [],
      "devils-foot": [],
      "great-harbor": [],
      "nonamesset-side": []
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Available endpoints: /, /health, /sites, /now, /forecast'
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: { message: 'Internal server error' }
  });
});

// Start server - bind to all interfaces for Render
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌊 Woods Hole Water Clarity Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Server ready to accept connections`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop other servers or use a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
