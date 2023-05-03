const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

router.get('/', async (req, res, next) => {
  try {
    const { rows: categories } = await db.query('SELECT * FROM categories');

    for (const category of categories) {
      const { rows: translations } = await db.query(
        'SELECT * FROM category_translations WHERE category_id = $1',
        [category.id]
      );
      category.translations = translations;
    }

    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, admin, async (req, res, next) => {
  const { translations } = req.body;

  try {
    const { rows } = await db.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [
      translations[0].name,
    ]);

    const categoryId = rows[0].id;

    for (const translation of translations) {
      await db.query(
        'INSERT INTO category_translations (category_id, language_id, name) VALUES ($1, $2, $3)',
        [categoryId, translation.language_id, translation.name]
      );
    }

    res.status(201).json({ msg: 'Category created', id: categoryId });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', auth, admin, async (req, res, next) => {
  const { id } = req.params;
  const { translations } = req.body;

  try {
    for (const translation of translations) {
      // Check if translation exists
      const { rows: existingTranslations } = await db.query(
        'SELECT * FROM category_translations WHERE category_id = $1 AND language_id = $2',
        [id, translation.language_id]
      );
      
      // If translation exists, update it. Otherwise, insert a new translation.
      if (existingTranslations.length > 0) {
        await db.query(
          'UPDATE category_translations SET name = $1 WHERE category_id = $2 AND language_id = $3',
          [translation.name, id, translation.language_id]
        );
      } else {
        await db.query(
          'INSERT INTO category_translations (category_id, language_id, name) VALUES ($1, $2, $3)',
          [id, translation.language_id, translation.name]
        );
      }
    }

    res.json({ msg: 'Category updated' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, admin, async (req, res, next) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM category_translations WHERE category_id = $1', [id]);
    await db.query('DELETE FROM categories WHERE id = $1', [id]);

    res.json({ msg: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;