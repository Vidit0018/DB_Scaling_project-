const { createClient } = require('redis');

// Initialize Redis Client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('[REDIS ERROR] Redis client encountered an error:', err);
});

redisClient.on('connect', () => {
  console.log('[REDIS] Connected successfully');
});

// Immediately attempt to connect
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('[REDIS] Failed to connect on startup:', err.message);
    // Note: Do not exit process, so the app still works (albeit slowly) if Redis is down
  }
})();

module.exports = redisClient;
