const autocannon = require('autocannon');

async function runLoadTest() {
  const url = process.env.TARGET_URL || 'http://localhost:3000/api/v1/analytics/peak-hours';

  const username = process.env.TEST_USER || 'vidit';
  const password = process.env.TEST_PASS || '1234';
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  // ── Windows-safe connection count ─────────────────────────────────────────
  // Node.js v20 on Windows has a known ERR_INTERNAL_ASSERTION bug when
  // autocannon opens >~200 simultaneous TCP connections. 100 connections
  // is the sweet spot: enough to saturate a cached Node.js endpoint, safe
  // enough to not crash the autocannon client itself.
  const CONNECTIONS = 100;
  const DURATION    = 30; // seconds

  console.log(`\n🚀  Warming up for 3s before main run...`);

  // ── Phase 1: Warm-up (ensure cache is hot before measuring) ───────────────
  await new Promise((resolve) => {
    autocannon({ url, connections: 10, duration: 3, headers: { Authorization: authHeader } }, resolve);
  });

  console.log(`✅  Warm-up done. Starting main load test...\n`);

  // ── Phase 2: Main load test ───────────────────────────────────────────────
  const statusCodeTally = {};

  const instance = autocannon(
    {
      url,
      connections: CONNECTIONS,
      duration: DURATION,
      pipelining: 1,           // HTTP/1.1 keep-alive (autocannon default)
      headers: { Authorization: authHeader },
    },
    finishedLoadTest
  );

  autocannon.track(instance, { renderProgressBar: true });

  instance.on('response', (_client, statusCode) => {
    statusCodeTally[statusCode] = (statusCodeTally[statusCode] || 0) + 1;
  });

  function finishedLoadTest(err, result) {
    if (err) {
      console.error('Load test error:', err);
      return;
    }

    const rps       = result.requests.average;
    const p99       = result.latency.p99;
    const avgMs     = result.latency.average;
    const tputMB    = (result.throughput.average / 1024 / 1024).toFixed(2);
    const errorRate = result.requests.total > 0
      ? ((result.errors / result.requests.total) * 100).toFixed(1)
      : '0.0';

    console.log('\nLoad Test Completed!');
    console.log('--------------------------------------------------');
    console.log(`URL Tested:              ${result.url}`);
    console.log(`Connections:             ${CONNECTIONS}`);
    console.log(`Duration:                ${DURATION}s`);
    console.log(`Total Requests:          ${result.requests.total}`);
    console.log(`Avg Latency:             ${avgMs} ms`);
    console.log(`p99 Latency:             ${p99} ms`);
    console.log(`Requests/sec (avg):      ${rps}`);
    console.log(`Throughput:              ${tputMB} MB/sec`);
    console.log(`Errors:                  ${result.errors} (${errorRate}%)`);
    console.log(`Timeouts:                ${result.timeouts}`);
    console.log(`Successful (2xx):        ${result['2xx']} / ${result.requests.total}`);
    console.log(`Response Codes:          `, statusCodeTally);
    console.log('--------------------------------------------------');

    if (rps >= 5000) {
      console.log(`🎉  EXCELLENT — ${rps.toLocaleString()} RPS! Goal achieved.`);
    } else if (rps >= 2000) {
      console.log(`✅  GOOD — ${rps.toLocaleString()} RPS. Solid throughput.`);
    } else {
      console.log(`⚠️  ${rps.toLocaleString()} RPS. Check server logs for errors.`);
    }
  }
}

runLoadTest();
