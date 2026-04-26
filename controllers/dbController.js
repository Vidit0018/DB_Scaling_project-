const pool = require('../config/db');
const memoryCache = require('../config/memoryCache');

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
    const limit = parseInt(req.query.limit) || 100;
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
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

const getTrips = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trips');
    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trips',
      error: error.message
    });
  }
};

const getUniquenessStats = async (req, res) => {
  try {
    const cacheKey = 'uniquenessStats';
    const cachedData = memoryCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: cachedData
      });
    }

    const query = `
      WITH total AS (
          SELECT NULLIF(COUNT(*), 0) AS total_rows FROM trips
      )
      SELECT
          (SELECT COUNT(*) FROM (SELECT VendorID FROM trips GROUP BY VendorID HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS VendorID_unique_pct,
          (SELECT COUNT(*) FROM (SELECT tpep_pickup_datetime FROM trips GROUP BY tpep_pickup_datetime HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS pickup_datetime_unique_pct,
          (SELECT COUNT(*) FROM (SELECT tpep_dropoff_datetime FROM trips GROUP BY tpep_dropoff_datetime HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS dropoff_datetime_unique_pct,
          (SELECT COUNT(*) FROM (SELECT passenger_count FROM trips GROUP BY passenger_count HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS passenger_count_unique_pct,
          (SELECT COUNT(*) FROM (SELECT trip_distance FROM trips GROUP BY trip_distance HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS trip_distance_unique_pct,
          (SELECT COUNT(*) FROM (SELECT pickup_longitude FROM trips GROUP BY pickup_longitude HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS pickup_longitude_unique_pct,
          (SELECT COUNT(*) FROM (SELECT pickup_latitude FROM trips GROUP BY pickup_latitude HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS pickup_latitude_unique_pct,
          (SELECT COUNT(*) FROM (SELECT RateCodeID FROM trips GROUP BY RateCodeID HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS RateCodeID_unique_pct,
          (SELECT COUNT(*) FROM (SELECT store_and_fwd_flag FROM trips GROUP BY store_and_fwd_flag HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS store_flag_unique_pct,
          (SELECT COUNT(*) FROM (SELECT dropoff_longitude FROM trips GROUP BY dropoff_longitude HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS dropoff_longitude_unique_pct,
          (SELECT COUNT(*) FROM (SELECT dropoff_latitude FROM trips GROUP BY dropoff_latitude HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS dropoff_latitude_unique_pct,
          (SELECT COUNT(*) FROM (SELECT payment_type FROM trips GROUP BY payment_type HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS payment_type_unique_pct,
          (SELECT COUNT(*) FROM (SELECT fare_amount FROM trips GROUP BY fare_amount HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS fare_amount_unique_pct,
          (SELECT COUNT(*) FROM (SELECT extra FROM trips GROUP BY extra HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS extra_unique_pct,
          (SELECT COUNT(*) FROM (SELECT mta_tax FROM trips GROUP BY mta_tax HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS mta_tax_unique_pct,
          (SELECT COUNT(*) FROM (SELECT tip_amount FROM trips GROUP BY tip_amount HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS tip_amount_unique_pct,
          (SELECT COUNT(*) FROM (SELECT tolls_amount FROM trips GROUP BY tolls_amount HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS tolls_amount_unique_pct,
          (SELECT COUNT(*) FROM (SELECT improvement_surcharge FROM trips GROUP BY improvement_surcharge HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS improvement_surcharge_unique_pct,
          (SELECT COUNT(*) FROM (SELECT total_amount FROM trips GROUP BY total_amount HAVING COUNT(*) = 1) t) * 100.0 / total.total_rows AS total_amount_unique_pct
      FROM total;
    `;
    const result = await pool.query(query);
    
    // Cache for 60 seconds
    memoryCache.set(cacheKey, result.rows[0], 60);

    res.status(200).json({
      success: true,
      source: 'database',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching uniqueness stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch uniqueness stats',
      error: error.message
    });
  }
};

const searchTrips = async (req, res) => {
  try {
    const { key, value, operator = 'eq' } = req.body;
    
    // Prevent SQL injection by validating the key against a list of known columns
    const validColumns = [
      'vendorid', 'tpep_pickup_datetime', 'tpep_dropoff_datetime', 'passenger_count', 
      'trip_distance', 'pickup_longitude', 'pickup_latitude', 'ratecodeid', 
      'store_and_fwd_flag', 'dropoff_longitude', 'dropoff_latitude', 'payment_type', 
      'fare_amount', 'extra', 'mta_tax', 'tip_amount', 'tolls_amount', 
      'improvement_surcharge', 'total_amount'
    ];

    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide both key and value in the request body.' });
    }

    if (!validColumns.includes(key.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid column name provided.' });
    }

    // Validate operator
    const validOperators = {
      'eq': '=',
      '=': '=',
      'neq': '!=',
      '!=': '!=',
      'gt': '>',
      '>': '>',
      'gte': '>=',
      '>=': '>=',
      'lt': '<',
      '<': '<',
      'lte': '<=',
      '<=': '<=',
      'in': 'IN',
      'between': 'BETWEEN',
      'like': 'LIKE',
      'ilike': 'ILIKE'
    };

    const sqlOperator = validOperators[operator.toLowerCase()];
    if (!sqlOperator) {
      return res.status(400).json({ success: false, message: 'Invalid operator provided. Supported operators: eq, neq, gt, gte, lt, lte, in, between, like, ilike' });
    }

    let query;
    let queryParams;

    if (sqlOperator === 'IN') {
      if (!Array.isArray(value) || value.length === 0) {
        return res.status(400).json({ success: false, message: 'Value must be a non-empty array for IN operator.' });
      }
      const placeholders = value.map((_, i) => `$${i + 1}`).join(', ');
      query = `SELECT * FROM trips WHERE ${key} IN (${placeholders})`;
      queryParams = [...value];
    } else if (sqlOperator === 'BETWEEN') {
      if (!Array.isArray(value) || value.length !== 2) {
        return res.status(400).json({ success: false, message: 'Value must be an array of exactly two elements for BETWEEN operator.' });
      }
      query = `SELECT * FROM trips WHERE ${key} BETWEEN $1 AND $2`;
      queryParams = [value[0], value[1]];
    } else {
      query = `SELECT * FROM trips WHERE ${key} ${sqlOperator} $1`;
      queryParams = [value];
    }

    const result = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });

  } catch (error) {
    console.error('Error searching trips:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search trips',
      error: error.message
    });
  }
};

const getComplexTripStats = async (req, res) => {
  try {
    const cacheKey = 'complexTripStats';
    const cachedData = memoryCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }

    const query = `
      SELECT 
          DATE(t1.tpep_pickup_datetime) AS trip_date,
          AVG(t1.total_amount) AS avg_fare,
          COUNT(*) AS total_trips
      FROM trips t1
      JOIN trips t2 
          ON DATE(t1.tpep_pickup_datetime) = DATE(t2.tpep_pickup_datetime)
      WHERE 
          EXTRACT(HOUR FROM t1.tpep_pickup_datetime) BETWEEN 8 AND 20
          AND t1.trip_distance > (
              SELECT AVG(trip_distance) FROM trips
          )
          AND t1.passenger_count IN (
              SELECT passenger_count FROM trips GROUP BY passenger_count
          )
      GROUP BY DATE(t1.tpep_pickup_datetime)
      ORDER BY avg_fare DESC;
    `;
    const result = await pool.query(query);
    
    // Cache for 60 seconds
    memoryCache.set(cacheKey, result.rows, 60);

    res.status(200).json({
      success: true,
      source: 'database',
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching complex trip stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complex trip stats',
      error: error.message
    });
  }
};

const analyticsQueries = {
  'date-range': `SELECT MIN(tpep_pickup_datetime) AS start_date, MAX(tpep_pickup_datetime) AS end_date FROM trips;`,
  'trips-per-day': `SELECT DATE(tpep_pickup_datetime) AS trip_date, COUNT(*) AS total_trips FROM trips GROUP BY trip_date ORDER BY trip_date;`,
  'peak-hours': `SELECT EXTRACT(HOUR FROM tpep_pickup_datetime) AS hour, COUNT(*) AS trips FROM trips GROUP BY hour ORDER BY trips DESC;`,
  'revenue-analysis': `SELECT SUM(total_amount) AS total_revenue, AVG(total_amount) AS avg_fare FROM trips;`,
  'revenue-by-hour': `SELECT EXTRACT(HOUR FROM tpep_pickup_datetime) AS hour, SUM(total_amount) AS revenue FROM trips GROUP BY hour ORDER BY revenue DESC;`,
  'passenger-distribution': `SELECT passenger_count, COUNT(*) AS trips FROM trips GROUP BY passenger_count ORDER BY trips DESC;`,
  'trip-distance-analysis': `SELECT AVG(trip_distance) AS avg_distance, MAX(trip_distance) AS max_distance FROM trips;`,
  'payment-type-usage': `SELECT payment_type, COUNT(*) AS usage_count FROM trips GROUP BY payment_type ORDER BY usage_count DESC;`,
  'tip-behavior': `SELECT AVG(tip_amount) AS avg_tip, MAX(tip_amount) AS max_tip FROM trips;`,
  'common-pickup-locations': `SELECT pickup_latitude, pickup_longitude, COUNT(*) AS trips FROM trips GROUP BY pickup_latitude, pickup_longitude ORDER BY trips DESC LIMIT 10;`,
  'common-routes': `SELECT pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, COUNT(*) AS trips FROM trips GROUP BY 1,2,3,4 ORDER BY trips DESC LIMIT 10;`,
  'longest-trips': `SELECT * FROM trips ORDER BY trip_distance DESC LIMIT 10;`,
  'efficiency': `SELECT AVG(total_amount / NULLIF(trip_distance, 0)) AS avg_fare_per_mile FROM trips;`,
  'detect-anomalies': `SELECT * FROM trips WHERE trip_distance = 0 AND total_amount > 0;`,
  'daily-revenue-trend': `SELECT DATE(tpep_pickup_datetime) AS day, SUM(total_amount) AS revenue FROM trips GROUP BY day ORDER BY day;`,
  'high-value-trips': `SELECT * FROM trips WHERE total_amount > 100 ORDER BY total_amount DESC;`,
  'correlation-insight': `SELECT trip_distance, AVG(total_amount) AS avg_fare FROM trips GROUP BY trip_distance ORDER BY trip_distance;`,
  'data-quality-check': `SELECT COUNT(*) FILTER (WHERE trip_distance IS NULL) AS null_distance, COUNT(*) FILTER (WHERE passenger_count IS NULL) AS null_passengers FROM trips;`,
  'composite-insight': `SELECT EXTRACT(HOUR FROM tpep_pickup_datetime) AS hour, COUNT(*) AS trips, SUM(total_amount) AS revenue FROM trips GROUP BY hour ORDER BY revenue DESC;`,
  'advanced-moving-avg': `SELECT tpep_pickup_datetime, total_amount, AVG(total_amount) OVER (ORDER BY tpep_pickup_datetime ROWS BETWEEN 100 PRECEDING AND CURRENT ROW) AS moving_avg FROM trips LIMIT 100;`
};

const getAnalytics = async (req, res) => {
  const { reportName } = req.params;
  const query = analyticsQueries[reportName];
  
  if (!query) {
    return res.status(404).json({ success: false, message: 'Analytics report not found. Available reports: ' + Object.keys(analyticsQueries).join(', ') });
  }

  try {
    const cacheKey = `analytics:${reportName}`;
    const cachedData = memoryCache.get(cacheKey);
    
    if (cachedData) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }

    const result = await pool.query(query);
    
    // Cache for 60 seconds
    memoryCache.set(cacheKey, result.rows, 60);

    res.status(200).json({
      success: true,
      source: 'database',
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error(`Error fetching analytics for ${reportName}:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch analytics: ${reportName}`,
      error: error.message
    });
  }
};

module.exports = {
  logConnection,
  getLogs,
  getTrips,
  getUniquenessStats,
  searchTrips,
  getComplexTripStats,
  getAnalytics
};
