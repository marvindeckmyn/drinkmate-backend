const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async function (req, res, next) {
    const token = req.header('x-auth-token');

    console.log(token)

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [decoded.user.id]);

        if (rows.length === 0) {
            req.user = null;
            return next();
        }

        req.user = {
            id: rows[0].id,
            username: rows[0].username,
            email: rows[0].email,
            is_admin: rows[0].is_admin
        };
        next();
    } catch (err) {
        console.error(err.message);
        req.user = null;
        next();
    }
};
