require('dotenv').config();
const { Client } = require('pg');
const { exec } = require('child_process');

const connectionString = process.env.DATABASE_URL;

async function getAuditLogCount(client) {
    const res = await client.query('SELECT COUNT(*) FROM audit_logs');
    return parseInt(res.rows[0].count, 10);
}

async function runTest() {
    const client = new Client({
        connectionString,
        ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const initialCount = await getAuditLogCount(client);
        console.log(`Initial audit_logs count: ${initialCount}`);

        console.log('\nRunning K6 load test (simulating traffic for 10s)...');
        
        const k6Process = exec('k6 run tests/test_audit_load.js');
        
        let k6Output = '';
        k6Process.stdout.on('data', (data) => {
            k6Output += data;
            process.stdout.write(data);
        });
        k6Process.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        await new Promise((resolve, reject) => {
            k6Process.on('exit', (code) => {
                if (code !== 0) {
                    console.warn(`K6 exited with code ${code}, but we will proceed.`);
                }
                resolve();
            });
            k6Process.on('error', reject);
        });

        // Extract http_reqs count from K6 output
        const httpReqsMatch = k6Output.match(/http_reqs[.\s]+:\s*(\d+)/);
        const httpReqs = httpReqsMatch ? parseInt(httpReqsMatch[1], 10) : 0;
        console.log(`\nTotal requests sent by K6: ${httpReqs}`);

        // Wait to allow auditLogger to flush its batches (it flushes every 5 seconds)
        console.log('Waiting 6 seconds to allow backend to flush logs to the database...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        const finalCount = await getAuditLogCount(client);
        console.log(`\nFinal audit_logs count: ${finalCount}`);

        const insertedLogs = finalCount - initialCount;
        console.log(`\n--- RESULT SUMMARY ---`);
        console.log(`Total requests sent by K6: ${httpReqs}`);
        console.log(`Total logs inserted in DB: ${insertedLogs}`);
        
        const difference = httpReqs - insertedLogs;
        if (difference === 0) {
            console.log('✅ PERFECT MATCH! All requests were successfully inserted into the audit_logs database.');
        } else if (difference > 0) {
            console.log(`⚠️ MISMATCH: ${difference} requests did NOT make it into the database.`);
            console.log(`This could be due to dropped requests, timeouts, or batch insertion failures under load.`);
        } else {
            console.log(`❓ UNEXPECTED: ${Math.abs(difference)} MORE logs were inserted than requests sent. (Perhaps background traffic from other sources?)`);
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await client.end();
    }
}

runTest();
