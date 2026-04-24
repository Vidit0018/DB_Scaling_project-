const express = require('express');
const router = express.Router();
const { logConnection, getLogs } = require('../controllers/dbController');
const { registerUser } = require('../controllers/authController');
const { basicAuth, adminAuth } = require('../middleware/basicAuth');

// This route allows a user to register
router.post('/register', registerUser);

// This route will handle GET requests to /api/v1/base
// Authenticated route
router.get('/base', basicAuth, logConnection);

// This route will fetch all audit logs
// Authenticated AND Admin only route
router.get('/logs', basicAuth, adminAuth, getLogs);

module.exports = router;
