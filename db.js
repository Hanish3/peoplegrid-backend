// db.js
const { Pool } = require('pg');

const pool = new Pool({
  // Example of a completed, correct connection string
  connectionString: 'postgresql://postgres:JZv72tdgEgeE92pu@db.nhemgbdlkoqitkwexqxo.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;