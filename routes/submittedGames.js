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
      SELECT submittedGames.id, submittedGames.name, submittedGames.player_count, submittedGames.description, submittedGames.alias, submittedGames.necessities, categories.name as category, users.username as creator
      FROM submitted_games
      JOIN categories on submitted_games.category_id = categories.id
      JOIN users on submitted_games.creator_id = users.id
      ORDER BY id DESC
    `);

    res.json(submittedGames);
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

module.exports = router;