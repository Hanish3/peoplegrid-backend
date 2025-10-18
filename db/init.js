require('dotenv').config();
const fs = require('fs');
const pool = require('../db');

const initDB = async () => {
  try {
    const schema = fs.readFileSync('db/schema.sql', 'utf8');
    await pool.query(schema);
    console.log('Database initialized successfully!');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  } finally {
    pool.end();
  }
};

initDB();
