const { Pool } = require('pg');
const config = require('../config/database');

const pool = new Pool(config);

module.exports = {
  query: (text, params) => pool.query(text, params),
};