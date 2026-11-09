/** Read-only integration smoke test. Requires local Magpie authentication. Never prints response bodies. */
export {};
const modulePath = '../server/official-api.ts';
const { officialRequest } = await import(modulePath) as typeof import('../server/official-api');
const paths = ['state', 'providers', 'settings', 'sessions/manage', 'library', 'usage?period=30d', 'usage/requests?period=30d&offset=0&limit=50', 'usage/heatmap', 'usage/quotas', 'context', 'groups', 'upstream', 'caller-keys', 'masking/summary', 'plugins', 'gateway/history', 'gateway/trace?after=0'];
let failures = 0;
for (const path of paths) {
  const start = Date.now();
  try {
    const data = await officialRequest(path);
    if (data === undefined || data === null) throw new Error('Empty response');
    console.log(JSON.stringify({ path, status: 'PASS', ms: Date.now() - start, shape: Array.isArray(data) ? 'array' : typeof data }));
  } catch (error) {
    failures++;
    console.log(JSON.stringify({ path, status: 'FAIL', error: String(error) }));
  }
}
process.exitCode = failures ? 1 : 0;
