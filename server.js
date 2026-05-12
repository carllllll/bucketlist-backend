// ================================================
// FILE LOCATION: bucketlist-backend/server.js
// PURPOSE: Main entry point — starts the server
// ================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ---- MIDDLEWARE ----
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ],
  credentials: true
}));

app.use(express.json());

// ---- ROUTES ----
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/bookings',   require('./routes/bookings'));
app.use('/api/payments',   require('./routes/payments'));
app.use('/api/reviews',    require('./routes/reviews'));

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