const { Pool } = require('pg');
const fs = require('fs');
const config = require('../config/database');

config.ssl = {
  rejectUnauthorized: false,
  ca: fs.readFileSync('db/ca-certificate.crt').toString(),
};

const pool = new Pool(config);

module.exports = {
  query: (text, params) => pool.query(text, params),
};