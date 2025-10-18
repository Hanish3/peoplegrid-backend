// db.js
const { Pool } = require('pg');
require('dotenv').config(); // Make sure environment variables are loaded

const pool = new Pool({
  // This will now correctly use the DATABASE_URL from Render
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;