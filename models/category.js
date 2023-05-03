const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);
    console.log('Categories table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};