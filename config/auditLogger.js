const pool = require('./db');

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds if not full

let logBatch = [];
let flushTimer = null;

const flushLogs = async () => {
  if (logBatch.length === 0) return;

  const logsToInsert = [...logBatch];
  logBatch = []; // Clear the batch immediately

  try {
    // Construct bulk insert query
    let query = `
      INSERT INTO audit_logs (
        user_id, user_email, method, endpoint, status_code, ip_address, user_agent, 
        headers, query_params, request_body, response_time_ms
      ) VALUES
    `;
    const values = [];
    let valueIdx = 1;

    const valueStrings = logsToInsert.map(log => {
      values.push(
        log.user_id, log.user_email, log.method, log.endpoint, log.status_code,
        log.ip_address, log.user_agent, log.headers, log.query_params, log.request_body, log.response_time_ms
      );
      const str = `($${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++}, $${valueIdx++})`;
      return str;
    });

    query += valueStrings.join(', ');

    await pool.query(query, values);
  } catch (err) {
    console.error(`[ERROR] Failed to flush audit logs in worker ${process.pid}:`, err.message);
  }
};

const pushLog = (logData) => {
  logBatch.push(logData);

  if (logBatch.length >= BATCH_SIZE) {
    if (flushTimer) clearTimeout(flushTimer);
    flushLogs();
    startTimer();
  }
};

const startTimer = () => {
  flushTimer = setTimeout(() => {
    flushLogs();
    startTimer();
  }, FLUSH_INTERVAL_MS);
};

// Start the initial timer
startTimer();

// Flush on process exit
process.on('SIGINT', async () => {
  await flushLogs();
  process.exit(0);
});

module.exports = {
  pushLog
};
