const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS game_translations (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        language_id INTEGER REFERENCES languages(id),
        name VARCHAR(255) NOT NULL,
        alias VARCHAR(255),
        description TEXT,
        UNIQUE (game_id, language_id)
      )
    `);
    console.log('Game translations table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};
