import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

export let options = {
    vus: 50,
    duration: '10s',
};

const TARGET_URL = __ENV.TARGET_URL || 'http://127.0.0.1:3000/api/v1/base';

function getRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export default function () {
    const testUser = 'saswat';
    const testPass = '1234';
    const credentials = encoding.b64encode(`${testUser}:${testPass}`);

    const headers = {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'X-Forwarded-For': getRandomIP(),
    };

    let res = http.get(TARGET_URL, { headers });
    check(res, { 'status is 200': (r) => r.status === 200 });
}
