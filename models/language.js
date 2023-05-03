const db = require('../db');

const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS languages (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL
      )
    `);
    console.log('Languages table created');
  } catch (err) {
    console.error(err);
  }
};

const addLanguages = async () => {
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'nl', name: 'Dutch' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
  ];

  for (const language of languages) {
    try {
      const { rows } = await db.query('SELECT * FROM languages WHERE code = $1', [language.code]);

      if (rows.length === 0) {
        await db.query('INSERT INTO languages (code, name) VALUES ($1, $2)', [language.code, language.name]);
        console.log(`Language added: ${language.name}`);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = {
  createTable,
  addLanguages,
};
