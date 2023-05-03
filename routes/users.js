const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');
const db = require('../db');

// Register user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const lowercaseUsername = username.toLowerCase();

  try {
    const checkUsername = await db.query('SELECT * FROM users WHERE LOWER(username) = $1', [lowercaseUsername]);
    const checkEmail = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (checkUsername.rows.length > 0 || checkEmail.rows.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3)', [username, email, hashedPassword]);

    const payload = { user: { id: email } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.cookie('userId', user.id, { httpOnly: true, sameSite: 'strict' });
      res.json({ token, isAdmin: user.is_admin, userId: user.id });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1 OR LOWER(username) = LOWER($1)', [identifier]);

    if (rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const payload = { user: { id: user.email } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.cookie('userId', user.id, { httpOnly: true, sameSite: 'strict' });
      res.json({ token, isAdmin: user.is_admin, userId: user.id });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Logout user and clear userId cookie
router.post('/logout', (req, res) => {
  res.clearCookie('userId');
  res.status(200).send('User logged out and cookie cleared');
});

// Get current user's information
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
})

// Get all users (admin only)
router.get('/', auth, admin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Toggle admin privilege (admin only)
router.put('/:id/toggle-admin', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const user = rows[0];
    const newIsAdmin = !user.is_admin;
    await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [newIsAdmin, id]);

    res.json({ msg: `User admin privilege toggled: ${newIsAdmin} `});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;