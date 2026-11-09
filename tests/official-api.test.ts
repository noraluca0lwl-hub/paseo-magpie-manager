import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
let signedIn = 0;
let calls = 0;
const key = 'test-only-local-key';
const server = createServer((req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  if (url.pathname === '/') {
    assert.equal(url.searchParams.get('k'), key);
    signedIn++;
    res.writeHead(303, { 'Set-Cookie': 'magpie=test; HttpOnly; Path=/', Location: '/' }); res.end(); return;
  }
  assert.equal(req.headers.cookie, 'magpie=test');
  calls++;
  if (url.pathname === '/api/settings') { res.writeHead(500); res.end('fixture error'); return; }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ agents: [], method: req.method }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const addr = server.address() as { port: number };
process.env.MAGPIE_WEB_ORIGIN = `http://127.0.0.1:${addr.port}`;
process.env.MAGPIE_WEB_KEY = key;
try {
  const modulePath = '../server/official-api.ts';
  const { officialRequest } = await import(modulePath);
  const [a, b] = await Promise.all([officialRequest('state'), officialRequest('providers')]);
  assert.equal(signedIn, 1); assert.deepEqual(a.agents, []); assert.equal(b.method, 'GET');
  assert.equal((await officialRequest('set', 'POST', { agent: 'fixture', field: 'model', value: 'fixture' })).method, 'POST');
  await assert.rejects(officialRequest('settings'), /fixture error/);
  assert.equal((await officialRequest('groups/save', 'POST', { id: 'fixture', members: ['fixture/a'] })).method, 'POST');
  assert.equal((await officialRequest('usage/quotas/refresh?provider=fixture&user=test%40example.com', 'POST', {})).method, 'POST');
  await officialRequest('sessions/transcript?agent=fixture&id=abc%3Adef');
  const before = calls;
  for (const path of ['../settings', 'state?k=leak', 'quit', 'http://example.com', 'state%3Fk=leak', 'sessions/transcript?agent=x&id=y&path=/etc/passwd', 'usage/quotas/refresh?provider=x&url=http://example.com']) await assert.rejects(officialRequest(path));
  assert.equal(calls, before);
  console.log('PASS: single-flight login, cookie, GET/POST, error propagation, route allowlist');
} finally { server.closeAllConnections(); server.close(); }
