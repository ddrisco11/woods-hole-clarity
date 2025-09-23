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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Check /health for server status'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌊 Woods Hole Water Clarity Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
