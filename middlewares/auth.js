const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [decoded.user.id]);

    if (rows.length === 0) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    req.user = {
      id: rows[0].id,
      email: rows[0].email,
      is_admin: rows[0].is_admin
    };
    next();
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};