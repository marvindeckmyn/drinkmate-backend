const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS necessities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        game_id INTEGER REFERENCES games(id),
        UNIQUE (name, game_id)
      )
    `);
    console.log('Necessities table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};
