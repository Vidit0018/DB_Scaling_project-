const express = require('express');
const router = express.Router();
const { logConnection, getLogs, getTrips, getUniquenessStats, searchTrips, getComplexTripStats, getAnalytics } = require('../controllers/dbController');
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

// This route will fetch trips data
// Authenticated AND Admin only route
router.get('/trips', basicAuth, adminAuth, getTrips);

// This route will fetch uniqueness stats for trips data
router.get('/trips/uniqueness', basicAuth, adminAuth, getUniquenessStats);

// This route will allow searching trips by a specific column key and value
router.post('/trips/search', basicAuth, adminAuth, searchTrips);

// This route runs a complex aggregation query over trips
router.get('/trips/complex-stats', basicAuth, adminAuth, getComplexTripStats);

// This route serves 20 different analytics queries dynamically based on the reportName parameter
router.get('/analytics/:reportName', basicAuth, adminAuth, getAnalytics);

module.exports = router;
