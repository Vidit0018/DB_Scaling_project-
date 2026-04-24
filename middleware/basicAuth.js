const bcrypt = require('bcrypt');
const pool = require('../config/db');

const basicAuth = async (req, res, next) => {
  // Check for Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. If you do not have an account, please register at /api/v1/register'
    });
  }

  try {
    // Extract credentials from basic auth header
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [name, password] = credentials.split(':');

    // Check if user exists in db
    const userQuery = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    if (userQuery.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username. Please register at /api/v1/register'
      });
    }

    const user = userQuery.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please try again or register at /api/v1/register'
      });
    }

    // Pass user to request so we can use it in endpoints
    req.user = user;
    next();
  } catch (error) {
    console.error('Basic auth error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication' });
  }
};

const adminAuth = (req, res, next) => {
  if (req.user && req.user.is_admin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required'
    });
  }
};

module.exports = {
  basicAuth,
  adminAuth
};
