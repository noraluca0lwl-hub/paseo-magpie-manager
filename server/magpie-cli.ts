/**
 * server/magpie-cli.ts — spawn the local `magpie` CLI and return stdout/stderr.
 */
import { spawn } from "node:child_process";

const MAGPIE_BIN = process.env.MAGPIE_BIN ?? "/root/.local/bin/magpie";
const TIMEOUT_MS = 20_000;

export interface CliResult {
  ok: boolean;
  output: string;
  error: string | null;
}

export async function runMagpie(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(MAGPIE_BIN, args, {
      env: { ...process.env, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? "/run/user/0" },
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    let out = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (out += d.toString()));
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, output: out, error: String(e) }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      // magpie prints diagnostics to stdout even on success; treat exit 0 as ok.
      resolve({ ok: code === 0, output: out.trim(), error: code === 0 ? null : out.trim() || `exit ${code}` });
    });
  });
}

/**
 * Parse `magpie providers` human output into provider entries.
 * Real format (verified against magpie 0.1.3370):
 *   test-relay custom  test-relay  example.com  ● sk-t…ummy  1 models
 * Columns separated by 2+ spaces; leading spaces trimmed.
 */
export function parseProviders(raw: string): Array<{
  id: string;
  name: string;
  host: string | null;
  models: number | null;
  usedBy: string[];
}> {
  const providers: Array<{ id: string; name: string; host: string | null; models: number | null; usedBy: string[] }> = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("no providers") || /^(magpie:|usage:)/.test(t)) continue;
    const cols = t.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cols.length === 0) continue;
    // first column: "<id> <type>" — the id is the first token
    const id = cols[0].split(/\s+/)[0];
    if (id.toLowerCase() === "provider") continue;
    // host column: any col that looks like a hostname/url and isn't the masked key
    const host =
      cols.find((c) =>
        /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(c) &&
        !c.startsWith("sk-"),
      ) ?? null;
    const modelsCol = cols.find((c) => /^\d+\s+models?$/.test(c));
    const models = modelsCol ? parseInt(modelsCol, 10) : null;
    // display name: a column equal to the id repeated (custom relays repeat it);
    // never a URL, never the models count
    const name =
      cols.find((c) => c === id) ??
      (cols.length > 1 && cols[1] !== id && !/^\d+\s+models?$/.test(cols[1]) && !/[a-z0-9-]+\.[a-z]{2,}/i.test(cols[1]) ? cols[1] : id);
    // "used by" appears as its own column set when agents reference the provider
    const usedBy = cols
      .filter((c) => c !== cols[0] && c !== host && c !== modelsCol && c !== name)
      .filter((c) => !c.startsWith("●") && !/^sk-/.test(c) && !/^\d+\s+models?$/.test(c))
      .map((c) => c.replace(/^used by\s+/i, ""));
    providers.push({ id, name, host, models, usedBy });
  }
  return providers;
}
