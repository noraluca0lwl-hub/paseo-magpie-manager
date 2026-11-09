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
 * Format sample (one per line):  deepseek   https://api.deepseek.com   3 models   used by claude
 * We keep it tolerant: columns separated by 2+ spaces or tabs.
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
    const cols = t.split(/\s{2,}|\t+/).map((c) => c.trim()).filter(Boolean);
    if (cols.length === 0) continue;
    const name = cols[0];
    if (name === "PROVIDER" || name.toLowerCase() === "provider") continue;
    const host = cols.find((c) => /^https?:\/\//.test(c)) ?? null;
    const modelsCol = cols.find((c) => /^\d+\s+models?$/.test(c));
    const models = modelsCol ? parseInt(modelsCol, 10) : null;
    const usedBy = cols.filter((c) => c !== name && c !== host && c !== modelsCol);
    providers.push({ id: name, name, host, models, usedBy });
  }
  return providers;
}
