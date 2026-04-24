const express = require('express');
const router = express.Router();
const { logConnection, getLogs } = require('../controllers/dbController');

// This route will handle GET requests to /api/v1/base
router.get('/base', logConnection);

// This route will fetch all audit logs
router.get('/logs', getLogs);

module.exports = router;
