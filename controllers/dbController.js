const pool = require('../config/db');

const logConnection = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 1. Basic DB check
    const dbCheck = await pool.query('SELECT NOW() AS current_time, version()');
    
    // 2. Prepare audit log data
    const method = req.method;
    const endpoint = req.originalUrl || req.url;
    
    // Attempt to parse out basic IP and client details
    const ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const headers = req.headers;
    const query_params = req.query;
    const request_body = req.body;
    
    // Time taken to do the DB check and parse before insertion
    const response_time_ms = Date.now() - startTime;
    const status_code = 200; // Assuming success if we reach here

    // Get user details from authenticated request
    const user_id = req.user ? req.user.id.toString() : null;
    const user_email = req.user ? req.user.name : null; // Mapping name to user_email as per instructions

    const insertQuery = `
      INSERT INTO audit_logs (
        user_id, user_email, method, endpoint, status_code, ip_address, user_agent, 
        headers, query_params, request_body, response_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      user_id,
      user_email,
      method,
      endpoint,
      status_code,
      ip_address,
      user_agent,
      headers,
      query_params,
      request_body,
      response_time_ms
    ];

    // 3. Insert into audit_logs table
    const auditResult = await pool.query(insertQuery, values);

    // 4. Send successful response
    res.status(200).json({
      success: true,
      message: 'Connection logged and database connected successfully',
      data: {
        serverTime: dbCheck.rows[0].current_time,
        version: dbCheck.rows[0].version,
        auditLogId: auditResult.rows[0].id // Just sending the ID back to confirm
      }
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request or log connection',
      error: error.message
    });
  }
};

const getLogs = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
      error: error.message
    });
  }
};

module.exports = {
  logConnection,
  getLogs
};
