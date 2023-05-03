const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS necessity_translations (
        id SERIAL PRIMARY KEY,
        necessity_id INTEGER REFERENCES necessities(id),
        language_id INTEGER REFERENCES languages(id),
        name VARCHAR(255) NOT NULL,
        UNIQUE (necessity_id, language_id)
      )
    `);
    console.log('Necessity translations table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};
