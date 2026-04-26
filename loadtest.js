const autocannon = require('autocannon');

async function runLoadTest() {
  // You can customize the URL, connections, and duration here
  const url = process.env.TARGET_URL || 'http://localhost:3000/api/v1/analytics/peak-hours';
  // const url = 'http://localhost:3000/api/v1/trips/uniqueness';

  // Example for Authenticated Endpoints:
  // If you want to test /api/v1/base or other authenticated routes,
  // provide a valid username and password of a registered user.
  const username = process.env.TEST_USER || 'vidit';
  const password = process.env.TEST_PASS || '1234';
  
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  const instance = autocannon({
    url: url,
    connections: 100, // high concurrency — cache is pre-warmed so these all serve from RAM
    duration: 30, // duration of the test in seconds
    headers: {
      'Authorization': authHeader // Uncomment this line to use Basic Auth for authenticated endpoints
    }
  }, finishedLoadTest);

  // This is used to display a real-time progress bar in the console
  autocannon.track(instance, { renderProgressBar: true });

  const statusCodeTally = {};
  instance.on('response', (client, statusCode, resBytes, responseTime) => {
    statusCodeTally[statusCode] = (statusCodeTally[statusCode] || 0) + 1;
  });

  function finishedLoadTest(err, result) {
    if (err) {
      console.error('Error running load test:', err);
      return;
    }
    console.log('\nLoad Test Completed!');
    console.log('--------------------------------------------------');
    console.log(`URL Tested: ${result.url}`);
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Average Latency: ${result.latency.average} ms`);
    console.log(`Requests per second (avg): ${result.requests.average}`);
    console.log(`Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Timeouts: ${result.timeouts}`);
    console.log(`Successful (2xx) Responses: ${result['2xx']} out of ${result.requests.total} total calls`);
    console.log('Response Codes Breakdown:', statusCodeTally);
    console.log('--------------------------------------------------');
  }
}

runLoadTest();
