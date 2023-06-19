const express = require('express');
const router = express.Router();
const db = require('../db');
const { check, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// Fetch submitted games
router.get('/', auth, admin, async (req, res, next) => {
  try {
    const { rows: submittedGames } = await db.query(`
      SELECT submitted_games.id, submitted_games.name, submitted_games.player_count, submitted_games.description, submitted_games.alias, submitted_games.necessities, categories.name as category, users.username as creator
      FROM submitted_games
      JOIN categories on submitted_games.category_id = categories.id
      JOIN users on submitted_games.creator_id = users.id
      ORDER BY id ASC
    `);

    res.json(submittedGames);
  } catch (err) {
    next(err);
  }
});

// Fetch a specific submitted game
router.get('/:id', auth, admin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows: [game] } = await db.query(`
      SELECT submitted_games.id, submitted_games.name, submitted_games.player_count, submitted_games.description, submitted_games.alias, submitted_games.necessities, categories.name as category, users.username as creator
      FROM submitted_games
      JOIN categories on submitted_games.category_id = categories.id
      JOIN users on submitted_games.creator_id = users.id
      WHERE submitted_games.id = $1
    `, [id]);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (err) {
    next(err);
  }
});

// Submit a game
router.post('/', auth, [
  check('name', 'Name is required').not().isEmpty(),
  check('player_count', 'Player count is required').isInt({ min: 1 }),
  check('description', 'Description is required').not().isEmpty(),
  check('category_id', 'Category is required').isInt({ min: 1 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, player_count, description, alias, necessities, category_id } = req.body;
    const creator_id = req.user.id;

    const { rows: [game] } = await db.query(`
      INSERT INTO submitted_games (name, player_count, description, alias, necessities, category_id, creator_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, player_count, description, alias, necessities, category_id, creator_id]);

    res.json(game);
  } catch (err) {
    next(err);
  }
});

// Approve a game
router.put('/:id/approve', auth, admin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Start transaction
    await db.query('BEGIN');

    // Fetch game from submitted_games
    const { rows: [submittedGame] } = await db.query(`
      SELECT * FROM submitted_games WHERE id = $1
    `, [id]);

    // Insert the game to the games table
    const { rows: [game] } = await db.query(`
      INSERT INTO games (name, player_count, image, description, alias, category_id, creator_id, publish, new)
      VALUES($1, $2, $3, $4, $5, $6, $7, false, true)
      RETURNING *
    `, [submittedGame.name, submittedGame.player_count, '', submittedGame.description, submittedGame.alias, submittedGame.category_id, submittedGame.creator_id]);

    // Insert the game to game_translations table
    await db.query(`
      INSERT INTO game_translations (game_id, language_id, name, alias, description)
      VALUES ($1, 1, $2, $3, $4)
    `, [game.id, game.name, game.alias, game.description]);

    // Parse necessities and insert into necessities table
    const necessities = submittedGame.necessities.split(',');
    for (let necessity of necessities) {
      necessity = necessity.trim(); // remove potential extra spaces

      // Insert the necessity to necessities table
      const { rows: [insertedNecessity] } = await db.query(`
        INSERT INTO necessities (name, game_id)
        VALUES ($1, $2)
        RETURNING *
      `, [necessity, game.id]);

      // Insert the necessity to necessity_translations table
      await db.query(`
        INSERT INTO necessity_translations (necessity_id, language_id, name)
        VALUES ($1, 1, $2)
      `, [insertedNecessity.id, necessity]);
    }

    // Delete the game from submitted_games
    await db.query(`
      DELETE FROM submitted_games WHERE id = $1
    `, [id]);

    // Commit the transaction
    await db.query('COMMIT');

    res.json(game);
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
});

// Reject a game
router.delete('/:id/reject', auth, admin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Delete the game from submitted_games
    await db.query(`
      DELETE FROM submitted_games WHERE id = $1
    `, [id]);

    res.json({ message: 'Game rejected and deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;