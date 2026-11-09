import assert from 'node:assert/strict';
const modulePath = '../client/gateway-data.ts';
const { connectionExample, gatewayModels, safeDetail } = await import(modulePath) as typeof import('../client/gateway-data');
const models = gatewayModels({ gateway: { groups: [{ id: 'group/main' }, null] }, providers: [{ id: 'a', name: 'A', models: [{ id: 'yes', on: true }, { id: 'no', on: false }] }, { id: 'off', off: true, models: [{ id: 'hidden', on: true }] }] });
assert.deepEqual(models.map(m=>m.id), ['group/main', 'a/yes']);
for(const [kind,path] of [['openai','/v1/chat/completions'],['responses','/v1/responses'],['anthropic','/v1/messages'],['gemini','/v1beta/models/a/yes:generateContent'],['systemone','/v1/systemone']]) {
 const e=connectionExample('http://127.0.0.1:3425/',kind,'a/yes'); assert.equal(e.url,`http://127.0.0.1:3425${path}`); assert.ok(e.curl.includes('curl '));
}
assert.ok(!safeDetail({headers:{Authorization:'sensitive',Cookie:'private','x-api-key':'hidden'},body:'hello'}).includes('sensitive'));
assert.ok(safeDetail({body:'hello'}).includes('hello'));
console.log('PASS gateway model filtering, protocol endpoints, sensitive header masking');
