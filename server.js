require('dotenv').config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log('Incoming', req.method, req.originalUrl, 'body=', req.body);
  next();
});

// Routes
const apiCheckRoute = require("./routes/apiCheck");
app.use("/api", apiCheckRoute);

// Error handler (capture uncaught errors and return JSON)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ message: 'Internal Server Error', error: err && err.message ? err.message : String(err) });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
