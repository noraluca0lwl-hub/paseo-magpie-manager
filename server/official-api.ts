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
  if (/[#\\\\]|\.\./.test(path)) return false;
  const [base, query = ""] = path.split("?");
  if (path.split("?").length > 2) return false;
  const params = new URLSearchParams(query);
  const queryKeys = base === "sessions/transcript" ? ["agent", "id"] : base === "usage/quotas/refresh" ? ["provider", "user"] : [];
  if ([...params.keys()].some(key => !queryKeys.includes(key))) return false;
  if (query && !queryKeys.length) return false;
  if (base === "sessions/transcript") return method === "GET" && !!params.get("agent") && !!params.get("id");
  if (base === "usage/quotas/refresh") return method === "POST" && !!params.get("provider");
  return method === "GET" ? reads.has(base) :
    /^(set|agents\/rescan|agents\/(connect|disconnect)\/[a-z0-9_-]+|provider\/(save|delete|test)|groups\/(save|delete|switch|template)|profile\/(save|use)|settings)$/.test(base);
}
export async function officialRequest(path: string, method = "GET", body?: unknown) {
  if (!allowed(path, method)) throw new Error("此接口未开放给插件");
  if (!cookie) await signIn();
  const request = () => fetch(`${origin}/api/${path}`, {
    method, headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    signal: AbortSignal.timeout(30000), redirect: "error",
  });
  let res = await request();
  if (res.status === 401) { await signIn(); res = await request(); }
  const text = await res.text();
  if (!res.ok) throw new Error(`Magpie ${path} (${res.status}): ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { throw new Error(`Magpie ${path} 返回的不是 JSON`); }
}
