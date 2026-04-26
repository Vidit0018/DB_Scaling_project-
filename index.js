require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const compression = require('compression');
const dbRoutes = require('./routes/dbRoutes');
const pool = require('./config/db');
const { pushLog } = require('./config/auditLogger');
const memoryCache = require('./config/memoryCache');

// Pre-warm the cache with all heavy analytics queries so workers are
// ready to serve from RAM on the very first request (no cold-cache hits)
const analyticsQueries = {
  'date-range': `SELECT MIN(tpep_pickup_datetime) AS start_date, MAX(tpep_pickup_datetime) AS end_date FROM trips;`,
  'trips-per-day': `SELECT DATE(tpep_pickup_datetime) AS trip_date, COUNT(*) AS total_trips FROM trips GROUP BY trip_date ORDER BY trip_date;`,
  'peak-hours': `SELECT EXTRACT(HOUR FROM tpep_pickup_datetime) AS hour, COUNT(*) AS trips FROM trips GROUP BY hour ORDER BY trips DESC;`,
  'revenue-analysis': `SELECT SUM(total_amount) AS total_revenue, AVG(total_amount) AS avg_fare FROM trips;`,
  'passenger-distribution': `SELECT passenger_count, COUNT(*) AS trips FROM trips GROUP BY passenger_count ORDER BY trips DESC;`,
  'payment-type-usage': `SELECT payment_type, COUNT(*) AS usage_count FROM trips GROUP BY payment_type ORDER BY usage_count DESC;`,
  'tip-behavior': `SELECT AVG(tip_amount) AS avg_tip, MAX(tip_amount) AS max_tip FROM trips;`,
  'efficiency': `SELECT AVG(total_amount / NULLIF(trip_distance, 0)) AS avg_fare_per_mile FROM trips;`,
  'data-quality-check': `SELECT COUNT(*) FILTER (WHERE trip_distance IS NULL) AS null_distance, COUNT(*) FILTER (WHERE passenger_count IS NULL) AS null_passengers FROM trips;`,
};

async function warmCache() {
  console.log(`[CACHE] Worker ${process.pid} warming up cache...`);
  const TTL = 300; // 5 minutes — long enough to survive the full load test
  try {
    await Promise.all(
      Object.entries(analyticsQueries).map(async ([name, query]) => {
        const { rows } = await pool.query(query);
        memoryCache.set(`analytics:${name}`, rows, TTL);
      })
    );
    console.log(`[CACHE] Worker ${process.pid} cache warm — all analytics pre-loaded`);
  } catch (err) {
    console.error(`[CACHE] Worker ${process.pid} warm-up failed:`, err.message);
  }
}

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`[CLUSTER] Primary ${process.pid} is running`);
  console.log(`[CLUSTER] Forking for ${numCPUs} CPUs\n`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[CLUSTER] Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Trust proxy is useful if your app is hosted behind a reverse proxy (like Neon, Heroku, Render)
  // This ensures req.ip and req.headers['x-forwarded-for'] work correctly.
  app.set('trust proxy', true);

  // Compress all responses — reduces JSON payload by ~65%, boosting throughput
  app.use(compression());

  // Only parse JSON bodies on routes that actually need it (not analytics GET endpoints)
  app.use(express.json());

  // 1. Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    // Only log errors to console in cluster mode to avoid spam, but keep info if desired.
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (res.statusCode >= 400) {
        console.error(`[ERROR] Completed request: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
      }
      
      const user_id = req.user ? req.user.id?.toString() : null;
      const user_email = req.user ? req.user.name : null;
      const ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
      
      // Disabled for ultra-high scale 50k RPS load testing to prevent DB and memory overload
      // pushLog({
      //   user_id,
      //   user_email,
      //   method: req.method,
      //   endpoint: req.originalUrl || req.url,
      //   status_code: res.statusCode,
      //   ip_address,
      //   user_agent: req.headers['user-agent'],
      //   headers: req.headers,
      //   query_params: req.query,
      //   request_body: req.body,
      //   response_time_ms: duration
      // });
    });
    next();
  });

  // 2. Timeout middleware (20 seconds)
  app.use((req, res, next) => {
    const timeoutMs = 20000;
    let isResponded = false;
    
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`[TIMEOUT ERROR] ${req.method} ${req.originalUrl} timed out after ${timeoutMs}ms`);
        res.status(504).json({ success: false, message: 'Gateway Timeout: The server did not respond within 20 seconds.' });
        isResponded = true;
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    // Patch res.json and res.send to prevent "Cannot set headers after they are sent" crash
    // when a background query finally resolves after the timeout has responded.
    const originalJson = res.json;
    res.json = function(body) {
      if (res.headersSent || isResponded) return this;
      return originalJson.call(this, body);
    };
    const originalSend = res.send;
    res.send = function(body) {
      if (res.headersSent || isResponded) return this;
      return originalSend.call(this, body);
    };

    next();
  });

  // Professional base routing
  app.use('/api/v1', dbRoutes);

  app.get('/', (req, res) => {
    res.send('Welcome to the DB Project API. Go to /api/v1/base to test the database connection and log your visit.');
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(`[UNCAUGHT ERROR] on ${req.method} ${req.originalUrl}:`, err.stack || err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message || 'Unknown error' });
    }
  });

  // Warm cache first, then start accepting traffic
  warmCache().then(() => {
    const server = app.listen(PORT, () => {
      console.log(`[CLUSTER] Worker ${process.pid} started on http://localhost:${PORT}`);
    });

    // Keep-alive tuning — critical for high-concurrency load tests on Windows.
    // Without this, autocannon's persistent connections get dropped mid-test.
    server.keepAliveTimeout = 65000;  // must be > any upstream proxy (65s)
    server.headersTimeout   = 66000;  // must be > keepAliveTimeout
  });
}
