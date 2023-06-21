const { Pool } = require('pg');
const fs = require('fs');
const config = require('../config/database');

const pool = new Pool(config);

config.ssl = {
  rejectUnauthorized: false,
  ca: fs.readFileSync('db/ca-certificate.crt').toString(),
};

module.exports = {
  query: (text, params) => pool.query(text, params),
};