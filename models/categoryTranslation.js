const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS category_translations (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id),
        language_id INTEGER REFERENCES languages(id),
        name VARCHAR(255) NOT NULL
      )
    `);
    console.log('Category translations table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};
