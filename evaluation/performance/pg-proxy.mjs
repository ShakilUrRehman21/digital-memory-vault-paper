// A TCP proxy between the application and PostgreSQL that (1) counts the SQL statements the application executes
// and (2) can add a fixed delay in each direction to emulate the network round trip to a hosted database.
//
// Statements are counted from the PostgreSQL frontend protocol: every Execute ('E') message of the extended
// protocol and every simple Query ('Q') message is one statement. A control server on CONTROL_PORT answers
// GET /count with the running total and POST /reset sets it to zero.
// Usage: LISTEN_PORT=6001 TARGET_PORT=5432 CONTROL_PORT=7001 DELAY_MS=5 node performance/pg-proxy.mjs
import net from 'node:net';
import http from 'node:http';

const LISTEN_PORT = Number(process.env.LISTEN_PORT || 6001);
const TARGET_HOST = process.env.TARGET_HOST || '127.0.0.1';
const TARGET_PORT = Number(process.env.TARGET_PORT || 5432);
const CONTROL_PORT = Number(process.env.CONTROL_PORT || 7001);
let DELAY_MS = Number(process.env.DELAY_MS || 0);
let statements = 0;

// Delays each chunk by DELAY_MS while preserving order.
function delayedPipe(from, to) {
  const queue = [];
  let timer = null;
  const flush = () => {
    timer = null;
    const now = Date.now();
    while (queue.length && queue[0].at <= now) to.write(queue.shift().buf);
    if (queue.length) timer = setTimeout(flush, queue[0].at - now);
  };
  from.on('data', (buf) => {
    if (DELAY_MS === 0) { to.write(buf); return; }
    queue.push({ buf, at: Date.now() + DELAY_MS });
    if (!timer) timer = setTimeout(flush, DELAY_MS);
  });
  from.on('end', () => to.end());
  from.on('error', () => to.destroy());
}

// Parses client-to-server traffic to count statements. The first message of a connection is the startup (or SSL
// request) packet, which has no type byte.
function counter() {
  let buf = Buffer.alloc(0), started = false;
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (!started) {
        if (buf.length < 4) return;
        const len = buf.readInt32BE(0);
        if (buf.length < len) return;
        const code = buf.length >= 8 ? buf.readInt32BE(4) : 0;
        buf = buf.subarray(len);
        if (code !== 80877103) started = true; // 80877103 = SSLRequest, followed by a real startup packet
        continue;
      }
      if (buf.length < 5) return;
      const type = String.fromCharCode(buf[0]);
      const len = buf.readInt32BE(1);
      if (buf.length < 1 + len) return;
      if (type === 'E' || type === 'Q') statements++;
      buf = buf.subarray(1 + len);
    }
  };
}

net.createServer((client) => {
  const server = net.connect(TARGET_PORT, TARGET_HOST);
  // Disable Nagle's algorithm: otherwise small protocol messages wait for delayed ACKs (~40 ms per exchange).
  client.setNoDelay(true);
  server.setNoDelay(true);
  client.on('data', counter());
  delayedPipe(client, server);
  delayedPipe(server, client);
  server.on('error', () => client.destroy());
}).listen(LISTEN_PORT, '127.0.0.1');

http.createServer((req, res) => {
  if (req.url === '/count') { res.end(JSON.stringify({ statements, delayMs: DELAY_MS })); return; }
  if (req.url === '/reset' && req.method === 'POST') { statements = 0; res.end('{}'); return; }
  const m = req.url.match(/^\/delay\/(\d+(?:\.\d+)?)$/);
  if (m && req.method === 'POST') { DELAY_MS = Number(m[1]); res.end(JSON.stringify({ delayMs: DELAY_MS })); return; }
  res.statusCode = 404; res.end();
}).listen(CONTROL_PORT, '127.0.0.1');
console.log(`pg-proxy :${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}, control :${CONTROL_PORT}, delay ${DELAY_MS} ms each way`);
