export const protocols=['chat','responses','anthropic','gemini','decide'] as const;
export type Protocol=typeof protocols[number];
export function modelIds(value:string){return [...new Set(value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean))];}
export function savedModelIds(models:unknown[]=[]){return models.flatMap(value=>typeof value==='string'?[value]:value&&typeof value==='object'&&(value as {on?:boolean}).on!==false&&typeof (value as {id?:unknown}).id==='string'?[(value as {id:string}).id]:[]);}
export function switchEndpoint(from:Protocol,to:Protocol,url:string,endpoints:Record<string,string>){
 const next={...endpoints,[from]:url};
 // Resolve protocol-specific address; callers retain draft endpoints.
 let target=next[to];
 if(!target){target=url.trim();if(to==='gemini')target=target.replace(/\/v1\/?$/,'/v1beta');else if(to==='chat'||to==='responses')target=target.replace(/\/v1beta\/?$/,'/v1');else if(to==='anthropic')target=target.replace(/\/v1(?:beta)?\/?$/,'');}
 return {url:target,endpoints:next};
}
// Read DTOs contain status objects (balanceToken, accessKey, accounts, models).
// Only explicit, shape-checked configuration fields may cross back into Save.
export function preservedProviderSettings(existing:Record<string,unknown>={}){
 const out:Record<string,unknown>={};
 for(const key of ['catalog','website','keysUrl','balanceURL','balancePath','balanceMethod','authHeader','routing','affinity'] as const)if(typeof existing[key]==='string')out[key]=existing[key];
 for(const key of ['unlisted','bestInFamily','listOff','searches','pinUpstream','unredacted','countFree','limitRestOff','imageFilesOff','nativeCompaction','passUserAgent'] as const)if(typeof existing[key]==='boolean')out[key]=existing[key];
 for(const key of ['fallback','hiddenDrawers','hiddenVideomakers','replyHeaders','passHeaders'] as const){const v=existing[key];if(Array.isArray(v)&&v.every(x=>typeof x==='string'))out[key]=v;}
 for(const key of ['contexts','outputs','compacts'] as const){const v=existing[key];if(v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(x=>typeof x==='number'))out[key]=v;}
 return out;
}
export function formHeaders(text:string):Record<string,string>{const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v)||Object.values(v).some(x=>typeof x!=='string'))throw new Error('Headers 需为字符串值 JSON 对象');return v;}
