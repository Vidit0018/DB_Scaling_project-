const bcrypt = require('bcrypt');
const pool = require('../config/db');

const registerUser = async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ success: false, message: 'Name and password are required' });
  }

  try {
    // Check if user already exists
    const checkQuery = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    if (checkQuery.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into database (is_admin defaults to false via DB schema)
    const insertQuery = `
      INSERT INTO users (name, password_hash)
      VALUES ($1, $2)
      RETURNING id, name, is_admin, created_at;
    `;
    const result = await pool.query(insertQuery, [name, passwordHash]);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering user', error: error.message });
  }
};

module.exports = {
  registerUser
};
