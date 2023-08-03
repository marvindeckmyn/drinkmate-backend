const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS game_slugs (
        game_id INTEGER REFERENCES games(id),
        language_id INTEGER REFERENCES languages(id),
        slug VARCHAR(255),
        PRIMARY KEY (game_id, language_id),
        UNIQUE(slug, language_id)
      )
    `);
    console.log('GameSlugs table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};