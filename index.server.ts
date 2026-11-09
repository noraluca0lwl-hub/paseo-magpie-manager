/**
 * index.server.ts — magpie-manager server entry.
 * Bridges the client panel to the local magpie CLI (CRUD) and gateway (quotas).
 */
import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  listProviders, addProvider, removeProvider, testProvider, setProviderKey, quotas, presets, webUiUrl,
  quotaJson, listAgents, setAgentModel, listGroups, addGroup, removeGroup, listModels,
} from "./shared/contracts";
import { runMagpie, parseProviders } from "./server/magpie-cli";

async function fetchQuotas(): Promise<string> {
  try {
    const res = await fetch("http://127.0.0.1:3425/v1/magpie/quotas", { signal: AbortSignal.timeout(5000) });
    return await res.text();
  } catch (e) {
    return `{"error":"${String(e)}"}`;
  }
}

export default function contribute(server: PluginServerContext) {
  server.handle(listProviders, async () => {
    const r = await runMagpie(["providers"]);
    if (!r.ok) return { ok: false, providers: [], raw: r.output, error: r.error };
    return { ok: true, providers: parseProviders(r.output), raw: r.output, error: null };
  });

  server.handle(addProvider, async ({ name, key, baseUrl }) => {
    const args = baseUrl
      ? ["provider", "add", name, `key=${key}`, `url=${baseUrl}`]
      : ["provider", "add", name, key];
    const r = await runMagpie(args);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(removeProvider, async ({ id }) => {
    const r = await runMagpie(["provider", "rm", id]);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(testProvider, async ({ id }) => {
    const r = await runMagpie(["provider", "test", id]);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(setProviderKey, async ({ id, key }) => {
    const r = await runMagpie(["provider", "set", id, `key=${key}`]);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(quotas, async () => {
    const body = await fetchQuotas();
    return { ok: !body.includes('"error"'), body, error: body.includes('"error"') ? body : null };
  });

  server.handle(presets, async () => {
    const r = await runMagpie(["presets"]);
    const out: Array<{ label: string; id: string; group: string }> = [];
    if (r.ok) {
      let group = "";
      for (const line of r.output.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        if (!/^magpie provider add/.test(t) && /^[a-zA-Z ()&.+-]+$/.test(t) && !/\s{2,}/.test(t) && !t.startsWith("magpie")) {
          group = t;
          continue;
        }
        const m = t.match(/^(.+?)\s{2,}(\S+)\s+magpie provider add/);
        if (m) out.push({ label: m[1].trim(), id: m[2], group: group || "vendors" });
      }
    }
    return { ok: r.ok, presets: out, error: r.ok ? null : r.error };
  });

  server.handle(webUiUrl, async () => {
    let up = false;
    try {
      const res = await fetch("http://127.0.0.1:3430/", { signal: AbortSignal.timeout(3000) });
      up = res.status === 401 || res.status === 200 || res.status === 303;
    } catch {
      up = false;
    }
    return { url: "http://127.0.0.1:3430/?k=blackflag-magpie-panel-2026", up };
  });

  server.handle(quotaJson, async () => {
    const r = await runMagpie(["quota", "--json"]);
    return { ok: r.ok, body: r.output, error: r.error };
  });

  server.handle(listAgents, async () => {
    const r = await runMagpie(["agents"]);
    const agents: Array<{ name: string; detail: string; detected: boolean }> = [];
    if (r.ok) {
      for (const line of r.output.split("\n")) {
        const t = line.replace(/\x1b\[[0-9;]*m/g, "").trim();
        if (!t || t.startsWith("magpie:")) continue;
        const m = t.match(/^(\S.*?)\s{2,}(.*)$/);
        if (m) agents.push({ name: m[1].trim(), detail: m[2].trim(), detected: !/not detected/.test(m[2]) });
      }
    }
    return { ok: r.ok, agents, error: r.ok ? null : r.error };
  });

  server.handle(setAgentModel, async ({ agent, model }) => {
    const r = await runMagpie([agent, model]);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(listGroups, async () => {
    const r = await runMagpie(["groups"]);
    const groups: Array<{ id: string; raw: string }> = [];
    if (r.ok) {
      for (const line of r.output.split("\n")) {
        const t = line.trim();
        if (t && !t.startsWith("magpie:")) groups.push({ id: t.split(/\s+/)[0], raw: t });
      }
    }
    return { ok: r.ok, groups, error: r.ok ? null : r.error };
  });

  server.handle(addGroup, async ({ name, models, routing }) => {
    const args = ["group", "add", name, `models=${models}`];
    if (routing) args.push(`routing=${routing}`);
    const r = await runMagpie(args);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(removeGroup, async ({ id }) => {
    const r = await runMagpie(["group", "rm", id]);
    return { ok: r.ok, output: r.output, error: r.error };
  });

  server.handle(listModels, async () => {
    const r = await runMagpie(["models"]);
    const models = r.ok
      ? r.output.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("magpie:"))
      : [];
    return { ok: r.ok, models, error: r.ok ? null : r.error };
  });

  return () => {};
}
