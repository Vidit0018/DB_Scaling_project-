import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';
import { Counter } from 'k6/metrics';

export let statusCodeCounter = new Counter('status_codes');

// Configure a realistic load test with stages simulating peak hours (10,000 users)
export let options = {
    stages: [
        // Ramp-up to 10,000 users
        { duration: '5m', target: 10000 },  // Sustain 10,000 users at peak
        { duration: '15m', target: 10000 },  // Sustain 10,000 users at peak
        { duration: '30s', target: 0 },   // Ramp-down to 0 users
    ],
};

// Allow URL override via environment variables, falling back to the default
const TARGET_URL = __ENV.TARGET_URL || 'http://192.168.1.43:3000/api/v1/analytics/peak-hours';

// Function to generate a random IP address
function getRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export default function () {
    // Authentication credentials matching test.js
    const testUser = __ENV.TEST_USER || 'saswat';
    const testPass = __ENV.TEST_PASS || '1234';
    const credentials = encoding.b64encode(`${testUser}:${testPass}`);

    // Headers with randomized IP to simulate different users
    const headers = {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'X-Forwarded-For': getRandomIP(),
    };

    // Hit the peak-hours endpoint (or whatever TARGET_URL is set to)
    let res = http.get(TARGET_URL, { headers });
    check(res, { 'status is 200': (r) => r.status === 200 });

    // Increment the status code counter with a tag for the specific code
    statusCodeCounter.add(1, { status: String(res.status) });

    // Random sleep between requests to simulate human behavior
    sleep(Math.random() * 2 + 1);
}

