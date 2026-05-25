/**
 * Scalability Test — PDC Project 6B
 * Tests: concurrent connections, message throughput, latency under load
 *
 * Usage:
 *   node tests/scalability_test.js [--url URL] [--clients N] [--messages M]
 *
 * Example:
 *   node tests/scalability_test.js --url http://localhost:3000 --clients 100 --messages 10
 */

const { io } = require('socket.io-client');

// ── CLI ARGS ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : def;
};

const CONFIG = {
  SERVER_URL: getArg('url', 'http://localhost:3000'),
  NUM_CLIENTS: parseInt(getArg('clients', '50')),
  MESSAGES_PER_CLIENT: parseInt(getArg('messages', '5')),
  RAMP_UP_DELAY_MS: parseInt(getArg('ramp', '100')), // ms between client spawns
  ROOM: getArg('room', 'general'),
  USERNAME_PREFIX: 'LoadBot',
};

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║   PDC Project 6B — Scalability Test Suite   ║');
console.log('╚══════════════════════════════════════════════╝\n');
console.log('Configuration:', CONFIG);
console.log('');

// ── METRICS ──────────────────────────────────────────────────────────────────
const results = {
  connections: { success: 0, failed: 0, times: [] },
  messages: { sent: 0, received: 0, latencies: [] },
  errors: [],
  startTime: null,
  endTime: null,
};

const clients = [];
let connectionsResolved = 0;
let messagesResolved = 0;
const totalMessages = CONFIG.NUM_CLIENTS * CONFIG.MESSAGES_PER_CLIENT;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── TEST RUNNER ───────────────────────────────────────────────────────────────
async function runTest() {
  results.startTime = Date.now();
  console.log(`🚀 Spawning ${CONFIG.NUM_CLIENTS} clients → ${CONFIG.SERVER_URL}`);
  console.log(`   Each client sends ${CONFIG.MESSAGES_PER_CLIENT} messages`);
  console.log(`   Total messages: ${totalMessages}`);
  console.log('');

  // Create all clients with ramp-up delay
  for (let i = 0; i < CONFIG.NUM_CLIENTS; i++) {
    spawnClient(i);
    if (CONFIG.RAMP_UP_DELAY_MS > 0) await sleep(CONFIG.RAMP_UP_DELAY_MS);
  }

  // Wait for all messages
  await waitForCompletion();
  results.endTime = Date.now();
  printReport();
  cleanup();
}

function spawnClient(index) {
  const connectStart = Date.now();
  const username = `${CONFIG.USERNAME_PREFIX}_${index}`;

  const socket = io(CONFIG.SERVER_URL, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 10000,
  });

  clients.push(socket);
  let messagesSent = 0;

  socket.on('connect', () => {
    const connectTime = Date.now() - connectStart;
    results.connections.success++;
    results.connections.times.push(connectTime);

    socket.emit('join', { username, room: CONFIG.ROOM });

    // Send messages after joining
    socket.on('user_info', () => {
      for (let m = 0; m < CONFIG.MESSAGES_PER_CLIENT; m++) {
        const sendTime = Date.now();
        socket.emit('send_message', {
          content: `Load test message ${m} from ${username} at ${sendTime}`,
          room: CONFIG.ROOM,
        });
        results.messages.sent++;
        messagesSent++;
      }
    });
  });

  socket.on('message', (msg) => {
    if (msg.type === 'chat' && msg.username?.startsWith(CONFIG.USERNAME_PREFIX)) {
      const latency = Date.now() - parseInt(msg.content.split(' at ')[1] || '0');
      if (latency > 0 && latency < 30000) results.messages.latencies.push(latency);
      results.messages.received++;
      messagesResolved++;
    }
  });

  socket.on('connect_error', (err) => {
    results.connections.failed++;
    results.errors.push(`Client ${index}: ${err.message}`);
    connectionsResolved++;
  });

  socket.on('disconnect', () => {});
  socket.on('error', (err) => results.errors.push(`Client ${index}: ${err}`));
}

function waitForCompletion() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('⏱  Timeout reached, generating report with partial results...');
      resolve();
    }, 60000); // 60 second max

    const check = setInterval(() => {
      process.stdout.write(`\r   Progress: ${results.messages.received}/${totalMessages} messages received | ${results.connections.success} connected`);
      if (results.messages.received >= totalMessages * 0.95) {
        clearInterval(check);
        clearTimeout(timeout);
        console.log('');
        resolve();
      }
    }, 500);
  });
}

function printReport() {
  const duration = (results.endTime - results.startTime) / 1000;
  const throughput = results.messages.received / duration;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('              SCALABILITY TEST REPORT              ');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n  Server:          ${CONFIG.SERVER_URL}`);
  console.log(`  Test Duration:   ${duration.toFixed(2)}s`);
  console.log('');
  console.log('  ── CONNECTIONS ───────────────────────────────────');
  console.log(`  Successful:      ${results.connections.success}`);
  console.log(`  Failed:          ${results.connections.failed}`);
  console.log(`  Avg Connect:     ${avg(results.connections.times).toFixed(1)}ms`);
  console.log(`  P95 Connect:     ${percentile(results.connections.times, 95).toFixed(1)}ms`);
  console.log('');
  console.log('  ── MESSAGE THROUGHPUT ────────────────────────────');
  console.log(`  Sent:            ${results.messages.sent}`);
  console.log(`  Received:        ${results.messages.received}`);
  console.log(`  Delivery Rate:   ${((results.messages.received / Math.max(results.messages.sent, 1)) * 100).toFixed(1)}%`);
  console.log(`  Throughput:      ${throughput.toFixed(1)} msg/s`);
  console.log('');
  console.log('  ── LATENCY ───────────────────────────────────────');
  if (results.messages.latencies.length) {
    console.log(`  Min:             ${Math.min(...results.messages.latencies)}ms`);
    console.log(`  Avg:             ${avg(results.messages.latencies).toFixed(1)}ms`);
    console.log(`  P50:             ${percentile(results.messages.latencies, 50)}ms`);
    console.log(`  P95:             ${percentile(results.messages.latencies, 95)}ms`);
    console.log(`  P99:             ${percentile(results.messages.latencies, 99)}ms`);
    console.log(`  Max:             ${Math.max(...results.messages.latencies)}ms`);
  } else {
    console.log('  (latency data not captured — increase ramp delay)');
  }
  console.log('');
  if (results.errors.length > 0) {
    console.log('  ── ERRORS ────────────────────────────────────────');
    results.errors.slice(0, 5).forEach(e => console.log(`  ⚠  ${e}`));
    if (results.errors.length > 5) console.log(`  ... and ${results.errors.length - 5} more`);
    console.log('');
  }
  console.log('═══════════════════════════════════════════════════\n');

  // Save JSON report
  const fs = require('fs');
  const report = { config: CONFIG, results, duration, throughput };
  const filename = `tests/report_${Date.now()}.json`;
  try {
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`  📄 Full report saved: ${filename}\n`);
  } catch {}
}

function cleanup() {
  clients.forEach(c => { try { c.disconnect(); } catch {} });
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  cleanup();
});
