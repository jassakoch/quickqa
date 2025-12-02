require('dotenv').config();
const express = require("express");
const cors = require("cors");
const rateLimit = require('express-rate-limit');
const { requireApiKey } = require('./lib/auth');
const quotas = require('./lib/quotas');

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// rate limiter for /api endpoints (configurable)
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const max = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const apiLimiter = rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

// require API key for mutating endpoints (POST/DELETE/PATCH) under /api
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return requireApiKey(req, res, next);
  return next();
});

// quotas for mutating endpoints: per-API-key or per-IP fixed-window counters
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  try {
    const apiKey = req.header('x-api-key') || undefined;
    const ip = req.ip;
    const result = quotas.hit(apiKey, ip);
    // set simple headers to help clients
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
    if (!result.allowed) {
      return res.status(429).json({ message: 'Too Many Requests', remaining: result.remaining, resetMs: result.resetMs });
    }
  } catch (e) {
    // on quota errors, fail closed (deny) to be conservative
    console.error('Quota check failed', e);
    return res.status(429).json({ message: 'Too Many Requests' });
  }
  return next();
});

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log('Incoming', req.method, req.originalUrl, 'body=', req.body);
  next();
});

// Routes
const apiCheckRoute = require("./routes/apiCheck");
app.use("/api", apiCheckRoute);

// Start scheduled cleanup of old reports (configurable via REPORT_TTL_DAYS env)
try {
  const { scheduleCleanup } = require('./lib/cleanup');
  const ttlDays = parseInt(process.env.REPORT_TTL_DAYS || '7', 10) || 7;
  scheduleCleanup({ ttlDays });
} catch (e) {
  console.error('Failed to start report cleanup scheduler', e);
}

// Error handler (capture uncaught errors and return JSON)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ message: 'Internal Server Error', error: err && err.message ? err.message : String(err) });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
} else {
  // when required by tests, export the app without starting the server
  module.exports = app;
}

