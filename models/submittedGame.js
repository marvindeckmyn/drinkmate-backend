const db = require('../db');

const createTable = async () => {
  try{
    await db.query(`
      CREATE TABLE IF NOT EXISTS submitted_games (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        player_count INTEGER NOT NULL,
        description TEXT NOT NULL,
        alias VARCHAR(255),
        necessities VARCHAR(255),
        category_id INTEGER REFERENCES categories(id),
        creator_id INTEGER REFERENCES users(id)
      )
    `);
    console.log('Submitted games table created');
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  createTable,
};