require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const slugify = require('slugify');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/games'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });
const auth = require('../middlewares/auth');
const softAuth = require('../middlewares/softAuth');
const admin = require('../middlewares/admin');
const fs = require('fs');
let fetch;

async function loadFetch() {
    const module = await import('node-fetch');
    fetch = module.default || module;
}

loadFetch();

// Fetch published games
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 10);
    const offset = (page - 1) * limit;
    const search = req.query.search;  // fetch search query parameter

    let gamesQuery = `
      SELECT games.id, games.name, games.player_count, games.image, games.description, games.alias, games.new, games.click_count, categories.name as category, games.category_id, game_slugs.slug
      FROM games
      JOIN categories ON games.category_id = categories.id
      JOIN game_slugs ON games.id = game_slugs.game_id
      JOIN languages ON game_slugs.language_id = languages.id
      WHERE games.publish = TRUE AND languages.code = $1
    `;
  
    let gamesParams = [req.query.language];  // Use req.query.language instead of i18n.language

    if (search) {
      const placeholder = `$${gamesParams.length + 1}`;
      gamesQuery += ` AND (LOWER(games.name) LIKE LOWER(${placeholder}) OR LOWER(games.alias) LIKE LOWER(${placeholder}))`;
      gamesParams.push(`%${search}%`);
  }

    gamesQuery += `
      ORDER BY games.click_count DESC
      LIMIT $${gamesParams.length + 1} OFFSET $${gamesParams.length + 2}
    `;

    gamesParams.push(limit, offset);

    const { rows: games } = await db.query(gamesQuery, gamesParams);

    for (const game of games) {
      const { rows: translations } = await db.query('SELECT game_translations.*, languages.code FROM game_translations JOIN languages ON game_translations.language_id = languages.id WHERE game_id = $1', [game.id]);
      const { rows: aliases } = await db.query('SELECT alias, language_id FROM game_translations WHERE game_id = $1', [game.id]);
      const { rows: descriptions } = await db.query('SELECT description, language_id FROM game_translations WHERE game_id = $1', [game.id]);
      const { rows: necessities } = await db.query(`SELECT necessities.id as necessity_id, necessities.name as necessity_name, necessity_translations.name as necessity_translation_name, necessity_translations.language_id as language_id 
         FROM necessities
         JOIN necessity_translations ON necessities.id = necessity_translations.necessity_id
         WHERE necessities.game_id = $1`,
        [game.id]);
      const { rows: categoryTranslations } = await db.query('SELECT category_translations.*, languages.code FROM category_translations JOIN languages ON category_translations.language_id = languages.id WHERE category_id = $1', [game.category_id]);

      game.translations = translations;
      game.aliases = aliases;
      game.descriptions = descriptions;
      game.necessities = necessities;
      game.categoryTranslations = categoryTranslations;
    }

    // Check if there are more games
    const { rowCount } = await db.query(`
      SELECT id FROM games WHERE games.publish = TRUE LIMIT $1 OFFSET $2
    `, [limit, offset + limit]);
    const hasMoreGames = rowCount > 0;

    // Send games along with a flag indicating if there are more games to load
    res.json({ games, hasMoreGames });

  } catch (err) {
    next(err);
  }
});

// Fetch published and unpublished games
router.get('/all', auth, admin, async (req, res, next) => {
  try {
    const { rows: games } = await db.query(`
      SELECT games.id, games.name, games.player_count, games.image, games.description, games.alias, games.new, games.publish, categories.name as category, games.category_id
      FROM games
      JOIN categories ON games.category_id = categories.id
      ORDER BY id DESC
    `);

    for (const game of games) {
      const { rows: translations } = await db.query('SELECT game_translations.*, languages.code FROM game_translations JOIN languages ON game_translations.language_id = languages.id WHERE game_id = $1', [game.id]);

      const { rows: aliases } = await db.query(
        'SELECT alias, language_id FROM game_translations WHERE game_id = $1',
        [game.id]
      );

      const { rows: descriptions } = await db.query(
        'SELECT description, language_id FROM game_translations WHERE game_id = $1',
        [game.id]
      );

      const { rows: necessities } = await db.query(
        `SELECT necessities.id as necessity_id, necessities.name as necessity_name, necessity_translations.name as necessity_translation_name, necessity_translations.language_id as language_id 
         FROM necessities
         JOIN necessity_translations ON necessities.id = necessity_translations.necessity_id
         WHERE necessities.game_id = $1`,
        [game.id]
      );

      const { rows: categoryTranslations } = await db.query('SELECT category_translations.*, languages.code FROM category_translations JOIN languages ON category_translations.language_id = languages.id WHERE category_id = $1', [game.category_id]);

      game.translations = translations;
      game.aliases = aliases;
      game.descriptions = descriptions;
      game.necessities = necessities;
      game.categoryTranslations = categoryTranslations;
    }
    
    res.json(games);
  } catch (err) {
    next(err);
  }
});

router.get('/:language_code/:slug', softAuth, async (req, res, next) => {
  try {
    const { slug, language_code } = req.params;

    const { rows: games } = await db.query(`
      SELECT games.id, games.name, games.player_count, games.image, games.description, games.alias, categories.name as category, games.category_id, users.username as creator
      FROM games
      JOIN categories ON games.category_id = categories.id
      JOIN users ON games.creator_id = users.id
      JOIN game_slugs ON games.id = game_slugs.game_id
      JOIN languages ON game_slugs.language_id = languages.id
      WHERE game_slugs.slug = $1 AND languages.code = $2
    `, [slug, language_code]);

    const game = games[0];
    const webhookUrl = process.env.DISCORD_LOG_URL;
    const geoApiKey = process.env.GEO_API_KEY;
    
    if (!game) {
      res.status(404).json({ message: 'Game not found' });
      return;
    }

    const { rows: translations } = await db.query('SELECT game_translations.*, languages.code FROM game_translations JOIN languages ON game_translations.language_id = languages.id WHERE game_id = $1', [game.id]);

    const { rows: aliases } = await db.query(
      `SELECT alias, game_translations.language_id, languages.code
       FROM game_translations
       JOIN languages ON game_translations.language_id = languages.id
       WHERE game_id = $1`,
      [game.id]
    );

    const { rows: descriptions } = await db.query(
      `SELECT description, game_translations.language_id, languages.code
       FROM game_translations
       JOIN languages ON game_translations.language_id = languages.id
       WHERE game_id = $1`,
      [game.id]
    );

    const { rows: necessities } = await db.query(
      `SELECT necessities.id as necessity_id, necessities.name as necessity_name, necessity_translations.name as necessity_translation_name, necessity_translations.language_id as language_id, languages.code as language_code 
       FROM necessities
       JOIN necessity_translations ON necessities.id = necessity_translations.necessity_id
       JOIN languages ON languages.id = necessity_translations.language_id
       WHERE necessities.game_id = $1`,
      [game.id]
    );

    const { rows: allSlugs } = await db.query(`
      SELECT game_slugs.slug, languages.code 
      FROM game_slugs 
      JOIN languages ON game_slugs.language_id = languages.id 
      WHERE game_slugs.game_id = $1
    `, [game.id]);

    const translatedSlugs = {};
    allSlugs.forEach(s => {
        translatedSlugs[s.code] = s.slug;
    });

    game.translatedSlugs = translatedSlugs;

    const necessitiesWithTranslations = {};

    for (const necessity of necessities) {
      if (!necessitiesWithTranslations[necessity.necessity_id]) {
        necessitiesWithTranslations[necessity.necessity_id] = {
          necessity_id: necessity.necessity_id,
          necessity_name: necessity.necessity_name,
          necessity_translation: [],
        };
      }
      necessitiesWithTranslations[necessity.necessity_id].necessity_translation.push({
        name: necessity.necessity_translation_name,
        code: necessity.language_code,
      });
    }

    const { rows: categoryTranslations } = await db.query('SELECT category_translations.*, languages.code FROM category_translations JOIN languages ON category_translations.language_id = languages.id WHERE category_id = $1', [game.category_id]);

    game.translations = translations;
    game.aliases = aliases;
    game.descriptions = descriptions;
    game.necessities = Object.values(necessitiesWithTranslations);
    game.categoryTranslations = categoryTranslations;

    if (!fetch) {
      throw new Error('Fetch is not yet available');
    }

    // Get the user's IP address from the request
    const forwardedIps = req.headers['x-forwarded-for'];
    const ipAddress = forwardedIps ? forwardedIps.split(',')[0] : req.connection.remoteAddress;

    // Fetch the geolocation data (make sure to handle potential errors from this API call)
    const geoResponse = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${geoApiKey}&ip=${ipAddress}`);
    const geoData = await geoResponse.json();

    const isLoggedIn = req.user && req.user.username;
    console.log(isLoggedIn);
    let content;
    if (isLoggedIn) {
        content = `${req.user.username} from ${geoData.city}, ${geoData.country_name} is watching ${game.name}`;
    } else {
        content = `Someone from ${geoData.city}, ${geoData.country_name} is watching ${game.name}`;
    }

    await fetch(webhookUrl, {
      method: 'post',
      body: JSON.stringify({ content }),
      headers: { 'Content-Type': 'application/json' },
    });

    res.json(game);
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, admin, upload.single('image'), async (req, res, next) => {
  try {
    let {
      translations,
      aliases,
      descriptions,
      necessities,
      player_count,
      category_id,
      publish,
      new: isNew,
    } = JSON.parse(req.body.data);

    if (typeof translations === 'string') {
      translations = JSON.parse(translations);
      aliases = JSON.parse(aliases);
      descriptions = JSON.parse(descriptions);
      necessities = JSON.parse(necessities);
    }

    if (typeof aliases === 'undefined' || !Array.isArray(aliases)) {
      aliases = []; // Set aliases to an empty array if it is undefined or not an array
    }

    if (typeof publish === 'string') {
      publish = publish === 'true';
    }
    if (typeof isNew === 'string') {
      isNew = isNew === 'true';
    }

    if (!translations || !translations.length || !translations[0].name) {
      return res.status(400).json({ error: 'Invalid translations data' });
    }

    // Check if the category_id is valid
    const categoryExists = await db.query(
      `SELECT EXISTS (SELECT 1 FROM categories WHERE id=$1)`,
      [category_id]
    );

    if (!categoryExists.rows[0].exists) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }

    const image = req.file ? path.join('games', req.file.filename).replace(/\\/g, '/') : '';

    // Check if the image is provided
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const alias = aliases && aliases[0] ? aliases[0].alias : null;
    const creator_id = 69;

    const { rows } = await db.query(
      `INSERT INTO games (name, player_count, image, description, alias, category_id, creator_id, publish, new)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [translations[0].name, player_count, image, descriptions[0].description, alias, category_id, creator_id, publish, isNew]
    );

    const gameId = rows[0].id;

    for (const translation of translations) {
      const alias = aliases.find(a => a.language_id === translation.language_id)?.alias || null;
      const description = descriptions.find(d => d.language_id === translation.language_id)?.description || '';
      const gameSlug = slugify(translation.name, { lower: true });

      await db.query(
        `INSERT INTO game_translations (game_id, language_id, name, alias, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, translation.language_id, translation.name, alias, description]
      );

      // Insert slug into game_slugs table
      await db.query(
        `INSERT INTO game_slugs (game_id, language_id, slug)
        VALUES ($1, $2, $3)`,
        [gameId, translation.language_id, gameSlug]
      );
    }

    for (const necessity of necessities) {
      const { rows: necessityRows } = await db.query(
        `INSERT INTO necessities (name, game_id) VALUES ($1, $2) RETURNING id`,
        [necessity.translations[0].name, gameId]
      );
      const necessityId = necessityRows[0].id;

      for (const translation of necessity.translations) {
        await db.query(
          `INSERT INTO necessity_translations (necessity_id, language_id, name)
           VALUES ($1, $2, $3)`,
          [necessityId, translation.language_id, translation.name]
        );
      }
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const username = req.user.username
    await (await fetch)(webhookUrl, {
      method: 'post',
      body: JSON.stringify({ content: `${username} has posted a new game with ID: ${gameId} and name: ${translations[0].name}` }),
      headers: { 'Content-Type': 'application/json' },
    });

    res.status(201).json({ id: gameId });
  } catch (err) {
    next(err);
  }
});

// Edit game
router.put('/:id', auth, admin, upload.single('image'), async (req, res, next) => {
  try {
    const gameId = req.params.id;
    const game_data = JSON.parse(req.body.game_data);
    const { translations, necessities, player_count, category_id, aliases, descriptions } = game_data;
    const updatedNecessityIds = [];

    const { rows: oldGameRows } = await db.query(
      `SELECT image FROM games WHERE id = $1`,
      [gameId]
    );
    const oldImage = oldGameRows[0].image;

    await db.query(
      `UPDATE games
      SET player_count = $1, category_id = $2
      WHERE id = $3`,
      [player_count, category_id, gameId]
    );

    if (req.file) {
      const newImage = req.file ? path.join('games', req.file.filename).replace(/\\/g, '/') : '';

      await db.query(
        `UPDATE games
        SET image = $1
        WHERE id = $2`,
        [newImage, gameId]
      );

      if (oldImage) {
        try {
          await fs.promises.unlink(path.join('public/', oldImage));
        } catch (err) {
          console.error(`Failed to delete old image: ${oldImage}`);
        }
      }
    }

    for (const translation of translations) {
      const gameSlug = slugify(translation.name, { lower: true });

      if (!translation.name) {
        continue;
      }

      await db.query(
        `INSERT INTO game_translations (game_id, language_id, name, alias)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, language_id) DO UPDATE
         SET name = $3, alias = $4`,
        [gameId, translation.language_id, translation.name, translation.alias]
      );

      // Update slug in game_slugs table
      await db.query(
        `INSERT INTO game_slugs (game_id, language_id, slug)
        VALUES ($1, $2, $3)
        ON CONFLICT (game_id, language_id) DO UPDATE
        SET slug = $3`,
        [gameId, translation.language_id, gameSlug]
      );
    }

    for (const alias of aliases) {
      const { language_id, alias: gameAlias } = alias;

      await db.query(
        `UPDATE game_translations
         SET alias = $1
         WHERE game_id = $2 AND language_id = $3`,
         [gameAlias, gameId, language_id]
      );

      if (language_id === 1) {
        await db.query(
          `UPDATE games
           SET alias = $1
           WHERE id = $2`,
           [gameAlias, gameId]
        );
      }
    }

    for (const description of descriptions) {
      const { language_id, description: gameDescription } = description;
  
      await db.query(
        `UPDATE game_translations 
         SET description = $1
         WHERE game_id = $2 AND language_id = $3`,
        [gameDescription, gameId, language_id]
      );
    }

    for (const necessity of necessities) {
      if (!necessity.name) {
        continue;
      }
      const { necessity_id, name, game_id, language_id } = necessity;

      if (necessity_id) {
        const { rows: necessityRows } = await db.query(
          `UPDATE necessities SET name = $1 WHERE id = $2 AND game_id = $3 RETURNING id`,
          [name, necessity_id, game_id]
        );
        const updatedNecessityId = necessityRows[0].id;
        
        await db.query(
          `INSERT INTO necessity_translations (necessity_id, language_id, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (necessity_id, language_id) DO UPDATE
           SET name = $3`,
          [updatedNecessityId, language_id, name]
        );

        updatedNecessityIds.push(updatedNecessityId);
      } else {
        // First, check if the necessity already exists
          const { rows: existingNecessityRows } = await db.query(
            `SELECT id FROM necessities WHERE name = $1 AND game_id = $2`,
            [name, game_id]
          );

          // If the necessity already exists, use its ID, otherwise insert a new necessity
          let newNecessityId;
          if (existingNecessityRows.length > 0) {
            newNecessityId = existingNecessityRows[0].id;
          } else {
            const { rows: necessityRows } = await db.query(
              `INSERT INTO necessities (name, game_id) VALUES ($1, $2) RETURNING id`,
              [name, game_id]
            );
            newNecessityId = necessityRows[0].id;
        }
        
        await db.query(
          `INSERT INTO necessity_translations (necessity_id, language_id, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (necessity_id, language_id) DO UPDATE
           SET name = $3`,
          [newNecessityId, language_id, name]
        );

        updatedNecessityIds.push(newNecessityId);
      }
    }
    
    if (updatedNecessityIds.length > 0) {
      await db.query(
        `DELETE FROM necessity_translations WHERE necessity_id IN (SELECT id FROM necessities WHERE game_id = $1 AND id NOT IN (${updatedNecessityIds.join(",")}))`,
        [gameId]
      );
      
      await db.query(
        `DELETE FROM necessities WHERE game_id = $1 AND id NOT IN (${updatedNecessityIds.join(",")})`,
        [gameId]
      );
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const username = req.user.username;
    await (await fetch)(webhookUrl, {
      method: 'post',
      body: JSON.stringify({ content: `${username} has updated the game with ID: ${gameId}.` }),
      headers: { 'Content-Type': 'application/json' },
    });
    
    res.status(200).json({ message: 'Game updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// Edit new property
router.put('/:id/new', auth, admin, async (req, res, next) => {
  try {
    const gameId = req.params.id;
    const { newValue } = req.body;

    await db.query(
      `UPDATE games
      SET new = $1
      WHERE id = $2`,
      [newValue, gameId]
    );

    res.status(200).json({ message: 'Game\'s new status updated successfully.'});
  } catch (err) {
    next(err);
  }
});

// Edit publish property
router.put('/:id/publish', auth, admin, async (req, res, next) => {
  try {
    const gameId = req.params.id;
    const { publishValue } = req.body;

    await db.query(
      `UPDATE games
      SET publish = $1
      WHERE id = $2`,
      [publishValue, gameId]
    );

    res.status(200).json({ message: 'Game\'s publish status updated successfully.'});
  } catch (err) {
    next(err);
  }
});

// Add click
router.put('/:id/click', async (req, res, next) => {
  try {
    const id = req.params.id;
    await db.query(`
      UPDATE games
      set click_count = click_count + 1
      WHERE id = $1
    `, [id]);

    res.json({ message: 'Game click count updated successfully.' });
  } catch (err) {
    next(err);
  }
})

router.delete('/:id', auth, admin, async (req, res, next) => {
  try {
    const gameId = req.params.id;

    // Image filename
    const { rows: imageRows } = await db.query('SELECT image FROM games WHERE id = $1', [gameId]);
    const imageFilename = imageRows[0].image;

    // Delete image file
    if (imageFilename) {
      await fs.promises.unlink(path.join('public/', imageFilename));
    }

    // Delete necessity translations
    await db.query(
      `DELETE FROM necessity_translations
       USING necessities
       WHERE necessities.id = necessity_translations.necessity_id AND necessities.game_id = $1`,
      [gameId]
    );

    // Delete necessities
    await db.query('DELETE FROM necessities WHERE game_id = $1', [gameId]);

    // Delete game translations
    await db.query('DELETE FROM game_translations WHERE game_id = $1', [gameId]);

    // Delete slugs associated with the game
    await db.query('DELETE FROM game_slugs WHERE game_id = $1', [gameId]);

    // Delete game
    await db.query('DELETE FROM games WHERE id = $1', [gameId]);

    res.status(200).json({ message: 'Game deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;