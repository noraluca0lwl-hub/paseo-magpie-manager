export type Row = Record<string, unknown>;
export const object = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
export const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(object) : [];
export const value = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v) : '';
export function gatewayModels(data: unknown) {
  const d = object(data), g = object(d.gateway);
  return [
    ...rows(g.groups).filter(m => typeof m.id === 'string').map(m => ({ ...m, id: value(m.id), providerName: '路由组', decision: false })),
    ...rows(d.providers).filter(p => !p.off).flatMap(p => rows(p.models).filter(m => m.on).map(m => ({ ...m, id: `${p.id}/${m.id}`, providerName: value(p.name || p.id), decision: !!p.decide }))),
  ];
}
export function connectionExample(origin: string, protocol: string, model: string, key = 'magpie') {
  const root = origin.replace(/\/+$/, '');
  const base = ['openai', 'responses', 'systemone'].includes(protocol) ? `${root}/v1` : root;
  const messages = [{ role: 'user', content: 'hi' }];
  const body = protocol === 'responses' ? { model, input: 'hi' } : protocol === 'anthropic' ? { model, max_tokens: 1024, messages } : protocol === 'gemini' ? { contents: [{ parts: [{ text: 'hi' }] }] } : protocol === 'systemone' ? { model, state: { message: 'hi' }, questions: { team: { type: 'choice', instructions: 'Which team should answer?', criteria: { billing: 'Payments', other: 'Other' } } } } : { model, messages };
  const url = protocol === 'gemini' ? `${root}/v1beta/models/${model}:generateContent` : protocol === 'anthropic' ? `${root}/v1/messages` : `${base}/${protocol === 'responses' ? 'responses' : protocol === 'systemone' ? 'systemone' : 'chat/completions'}`;
  const headers = protocol === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : protocol === 'gemini' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` };
  const quote = (s: string) => `'${s.replace(/'/g, `'"'"'`)}'`;
  const curl = `curl ${quote(url)} \\\n  -H 'Content-Type: application/json'${Object.entries(headers).map(([k,v]) => ` \\\n  -H ${quote(`${k}: ${v}`)}`).join('')} \\\n  -d ${quote(JSON.stringify(body, null, 2))}`;
  return { base, url, headers, body, curl };
}
/** Bodies contain conversation data; authorization-bearing fields stay masked. */
export function safeDetail(data: unknown): string {
  return JSON.stringify(data, (k, v) => /authorization|api[-_]?key|cookie|token|secret|password/i.test(k) ? '[已隐藏]' : v, 2) ?? '';
}
