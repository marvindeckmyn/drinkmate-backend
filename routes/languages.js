const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM languages');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;