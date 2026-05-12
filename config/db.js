// ================================================
// FILE LOCATION: bucketlist-backend/config/db.js
// PURPOSE: Connects to Supabase using API URL
// ================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('✅ Supabase client ready');

module.exports = supabase;