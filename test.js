import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

// Configure a realistic load test with stages
export let options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp-up to 20 users
    { duration: '30s', target: 20 }, // Sustain 20 users
    { duration: '10s', target: 0 },  // Ramp-down to 0 users
  ],
};

const BASE_URL = 'http://192.168.1.43:3000/api/v1';

// Function to generate a random IP address
function getRandomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export default function () {
  // Authentication credentials
  const credentials = encoding.b64encode('saswat:1234');
  
  // Headers with randomized IP to simulate different users
  const headers = {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
    'X-Forwarded-For': getRandomIP(),
  };

  // 1. Hit the base endpoint
  let resBase = http.get(`${BASE_URL}/base`, { headers });
  check(resBase, { 'GET /base status is 200': (r) => r.status === 200 });

  // 2. Hit the logs endpoint
  let resLogs = http.get(`${BASE_URL}/logs`, { headers });
  check(resLogs, { 'GET /logs status is 200': (r) => r.status === 200 });

  // 3. Hit the uniqueness endpoint
  let resUniqueness = http.get(`${BASE_URL}/trips/uniqueness`, { headers });
  check(resUniqueness, { 'GET /trips/uniqueness status is 200': (r) => r.status === 200 });

  // 4. Hit the search endpoint with a payload
  const searchPayload = JSON.stringify({
    column: 'vendor_id',
    operator: 'eq',
    value: 1
  });
  let resSearch = http.post(`${BASE_URL}/trips/search`, searchPayload, { headers });
  check(resSearch, { 'POST /trips/search status is 200': (r) => r.status === 200 });

  // 5. Hit the complex-stats endpoint
  let resComplex = http.get(`${BASE_URL}/trips/complex-stats`, { headers });
  check(resComplex, { 'GET /trips/complex-stats status is 200': (r) => r.status === 200 });

  // Random sleep between requests to simulate human behavior
  sleep(Math.random() * 2 + 1); 
}