require('dotenv').config();
const express = require('express');
const dbRoutes = require('./routes/dbRoutes');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy is useful if your app is hosted behind a reverse proxy (like Neon, Heroku, Render)
// This ensures req.ip and req.headers['x-forwarded-for'] work correctly.
app.set('trust proxy', true);

app.use(express.json());

// 1. Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[INFO] Incoming request: ${req.method} ${req.originalUrl}`);
  res.on('finish', async () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.error(`[ERROR] Completed request: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
    } else {
      console.log(`[INFO] Completed request: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
    }

    try {
      const user_id = req.user ? req.user.id?.toString() : null;
      const user_email = req.user ? req.user.name : null;
      const ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
      
      const insertQuery = `
        INSERT INTO audit_logs (
          user_id, user_email, method, endpoint, status_code, ip_address, user_agent, 
          headers, query_params, request_body, response_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      const values = [
        user_id,
        user_email,
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        ip_address,
        req.headers['user-agent'],
        req.headers,
        req.query,
        req.body,
        duration
      ];
      await pool.query(insertQuery, values);
    } catch (err) {
      console.error('[ERROR] Failed to save audit log:', err.message);
    }
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
