const { Pool } = require('pg');
const os = require('os');
require('dotenv').config();

// Cap total connections across all cluster workers within Neon free-tier limit (~30).
// Each worker gets an equal share: floor(20 / numCPUs), minimum 2.
const numCPUs = os.cpus().length;
const poolMax = Math.max(2, Math.floor(20 / numCPUs));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: 30000,       // Release idle connections after 30s
  connectionTimeoutMillis: 5000,  // Fail fast if DB is unreachable
  statement_timeout: 20000,       // Cancel runaway queries after 20s
});

// Catch errors on idle clients to prevent the Node.js process from crashing
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err.message);
});

// Test the connection and initialize tables
pool.connect(async (err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Successfully connected to the database');

  try {
    // Automatically create the users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Also automatically create audit_logs table if you haven't yet
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        user_email TEXT,
        method VARCHAR(10) NOT NULL,
        endpoint TEXT NOT NULL,
        status_code INT,
        ip_address INET,
        user_agent TEXT,
        device_type VARCHAR(50),
        browser VARCHAR(100),
        request_body JSONB,
        query_params JSONB,
        headers JSONB,
        response_time_ms INT,
        country VARCHAR(100),
        city VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database tables verified/created successfully.');
  } catch (setupError) {
    console.error('Failed to create database tables:', setupError.message);
  }

  release();
});

module.exports = pool;
