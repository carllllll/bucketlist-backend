// ================================================
// FILE LOCATION: bucketlist-backend/server.js
// PURPOSE: Main entry point — starts the server
// ================================================

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Render containers have no IPv6 route — force DNS to return IPv4 first so
// outbound connections (e.g. Gmail SMTP) don't fail with ENETUNREACH on an IPv6 address.
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const app = express();

// ---- TRUST PROXY ----
// Required for express-rate-limit to work correctly behind Render's proxy
app.set('trust proxy', 1);

// ---- RATE LIMITING ----
// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again in 15 minutes.' }
});

// Stricter limit for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Booking limit (prevent spam bookings)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many booking attempts. Please try again in an hour.' }
});

// Payment limit
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many payment attempts. Please try again in an hour.' }
});

// ---- MIDDLEWARE ----
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ].filter(Boolean), // Removes undefined if FRONTEND_URL is not set
  credentials: true
}));

app.use(express.json());

// ---- ROUTES ----
// Note: apiLimiter is applied per-route to avoid double-limiting auth routes
app.use('/api/auth',       authLimiter,    require('./routes/auth'));
app.use('/api/properties', apiLimiter,     require('./routes/properties'));
app.use('/api/bookings',   bookingLimiter, require('./routes/bookings'));
app.use('/api/payments',   paymentLimiter, require('./routes/payments'));
app.use('/api/reviews',    apiLimiter,     require('./routes/reviews'));

// ---- HEALTH CHECK ----
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Bucketlist Staycations API',
    version: '1.0.0'
  });
});

// ---- START ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});