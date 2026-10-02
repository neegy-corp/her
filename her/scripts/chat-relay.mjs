// Independently implemented inbound relay. It does not scrape or post to pump.fun.
import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function createChatRelay({ token, mint }) {
  if (typeof token !== 'string' || token.length < 32) throw new Error('HER_RELAY_TOKEN must be at least 32 characters.');
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || '')) throw new Error('HER_RELAY_MINT must be a valid token address.');
  const entries = [];
  const ids = new Set();
  let lastTime = 0;
  const expected = Buffer.from(`Bearer ${token}`);
  return createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { req.resume(); return send(401, { error: 'Unauthorized' }); }
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/feed') {
      if (url.searchParams.get('mint') !== mint) return send(400, { error: 'Wrong room' });
      const after = Number(url.searchParams.get('after') || 0);
      if (!Number.isFinite(after) || after < 0) return send(400, { error: 'Invalid cursor' });
      return send(200, { messages: entries.filter(m => m.timestamp > after).slice(0, 100) });
    }
    if (req.method !== 'POST' || url.pathname !== '/api/chat/incoming') { req.resume(); return send(404, { error: 'Not found' }); }
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8192) { send(413, { error: 'Body too large' }); return; } chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || typeof body.text !== 'string' || !body.text.trim()) return send(400, { error: 'Nonempty text required' });
      if (body.mint !== undefined && body.mint !== mint) return send(400, { error: 'Wrong room' });
      const id = typeof body.id === 'string' && body.id.trim() ? body.id.slice(0, 180) : randomUUID();
      if (ids.has(id)) return send(200, { id, duplicate: true });
      // Receipt time matches the studio's cursor. Monotonic within this process.
      lastTime = Math.max(Date.now(), lastTime + 1);
      const entry = { id, user: typeof body.author === 'string' ? body.author.slice(0, 40) : 'viewer', text: body.text.trim().slice(0, 400), timestamp: lastTime };
      entries.push(entry); ids.add(id);
      if (entries.length > 500) ids.delete(entries.shift().id);
      send(201, entry);
    } catch { if (!res.writableEnded) send(400, { error: 'Invalid request body' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createChatRelay({ token: process.env.HER_RELAY_TOKEN, mint: process.env.HER_RELAY_MINT });
  server.requestTimeout = 10000;
  server.listen(Number(process.env.PORT || 4501), process.env.HOST || '127.0.0.1', () => console.log('HER relay listening. POST /api/chat/incoming; GET /feed. Bearer authentication required.'));
}
