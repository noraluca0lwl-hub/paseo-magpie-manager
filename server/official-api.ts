/** Server-only bridge to the same HTTP API used by Magpie's Windows UI. */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
const origin = process.env.MAGPIE_WEB_ORIGIN ?? "http://127.0.0.1:3430";
let cookie = "";
let signingIn: Promise<void> | undefined;
async function signIn() {
  const key = process.env.MAGPIE_WEB_KEY ?? await readFile(`${homedir()}/.config/magpie/paseo-web-key`, "utf8").then(s => s.trim()).catch(() => "");
  if (!key) throw new Error("未设置 MAGPIE_WEB_KEY：请在 Paseo daemon 环境中配置本机 Magpie Web 密钥");
  if (!signingIn) signingIn = (async () => {
    const res = await fetch(`${origin}/?k=${encodeURIComponent(key)}`, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (res.status !== 303) throw new Error(`Magpie 登录失败 (${res.status})`);
    cookie = res.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    if (!cookie) throw new Error("Magpie 未返回登录 cookie");
  })().finally(() => { signingIn = undefined; });
  await signingIn;
}
const reads = new Set(["state", "providers", "settings", "sessions", "library", "usage", "usage/quotas", "groups", "upstream", "masking/summary", "plugins"]);
function allowed(path: string, method: string) {
  if (method !== "GET" && method !== "POST") return false;
  if (/[#\\\\]|\.\./.test(path)) return false;
  const [base, query = ""] = path.split("?");
  if (path.split("?").length > 2) return false;
  const params = new URLSearchParams(query);
  const queryKeys = base === "library/skill" ? ["name", "file"] : base === "sessions/transcript" ? ["agent", "id"] : base === "usage/quotas/refresh" ? ["provider", "user"] : [];
  if ([...params.keys()].some(key => !queryKeys.includes(key))) return false;
  if (query && !queryKeys.length) return false;
  if (method === 'GET' && /^icons\/[a-zA-Z0-9_.-]+$/.test(base)) return true;
  if (base === "library/skill") return method === "GET" && !!params.get("name");
  if (base === "sessions/transcript") return method === "GET" && !!params.get("agent") && !!params.get("id");
  if (base === "usage/quotas/refresh") return method === "POST" && !!params.get("provider");
  return method === "GET" ? reads.has(base) :
    /^(icons\/(favicon|url)|set|agents\/rescan|agents\/(connect|disconnect)\/[a-z0-9_-]+|provider\/(save|delete|test|list|models|detect|on|off)|groups\/(save|delete|switch|template)|profile\/(save|use)|library\/(instructions\/save|servers\/(save|agents|remove)|hooks\/(save|agents|remove)|subagents\/(save|agents|remove)|skills\/(save|agents|remove|probe|install|update))|settings)$/.test(base);
}
export async function officialRequest(path: string, method = "GET", body?: unknown) {
  if (!allowed(path, method)) throw new Error("此接口未开放给插件");
  if (!cookie) await signIn();
  const asset = path.match(/^icons\/(builtin-[a-zA-Z0-9_-]+\.(?:svg|png))$/);
  const resource = asset ? `/icons/${asset[1].slice(8)}` : `/api/${path}`;
  const request = () => fetch(`${origin}${resource}`, {
    method, headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    signal: AbortSignal.timeout(path === 'provider/detect' && Array.isArray((body as {detectModels?:unknown}|undefined)?.detectModels) ? 125000 : 30000), redirect: "error",
  });
  let res = await request();
  if (res.status === 401) { await signIn(); res = await request(); }
  if (method === 'GET' && path.startsWith('icons/') && res.ok) {
    const mime = (res.headers.get('content-type') ?? '').split(';')[0];
    if (!['image/svg+xml','image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon'].includes(mime)) throw new Error('图标格式未识别');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 1024 * 1024) throw new Error('图标超过 1 MB');
    if (mime === 'image/svg+xml') return { svg: bytes.toString('utf8'), mime };
    return { uri: `data:${mime};base64,${bytes.toString('base64')}`, mime };
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Magpie ${path} (${res.status}): ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { throw new Error(`Magpie ${path} 返回的不是 JSON`); }
}
