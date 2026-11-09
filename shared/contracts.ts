/**
 * shared/contracts.ts — RPC contracts for magpie-manager.
 * Server side spawns the local `magpie` CLI; client side renders the panel.
 */
import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const panelPreferences = defineRpc({
  name: "magpie.panel.preferences",
  input: z.object({ theme: z.enum(["system", "light", "dark"]).optional() }),
  output: z.object({ theme: z.enum(["system", "light", "dark"]) }),
});

export const officialApi = defineRpc({
  name: "magpie.official",
  input: z.object({ path: z.string(), method: z.enum(["GET", "POST"]).default("GET"), body: z.unknown().optional() }),
  output: z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.string().nullable() }),
});

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string().nullable(),
  models: z.number().nullable(),
  usedBy: z.array(z.string()).default([]),
});

export const listProviders = defineRpc({
  name: "magpie.list",
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    providers: z.array(ProviderSchema),
    raw: z.string().nullable(),
    error: z.string().nullable(),
  }),
});

export const addProvider = defineRpc({
  name: "magpie.add",
  input: z.object({
    name: z.string(),
    key: z.string(),
    baseUrl: z.string().optional(),
  }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const removeProvider = defineRpc({
  name: "magpie.rm",
  input: z.object({ id: z.string() }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const testProvider = defineRpc({
  name: "magpie.test",
  input: z.object({ id: z.string() }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const setProviderKey = defineRpc({
  name: "magpie.setkey",
  input: z.object({ id: z.string(), key: z.string() }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const quotas = defineRpc({
  name: "magpie.quotas",
  input: z.object({}),
  output: z.object({ ok: z.boolean(), body: z.string(), error: z.string().nullable() }),
});

export const presets = defineRpc({
  name: "magpie.presets",
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    presets: z.array(z.object({
      label: z.string(),
      id: z.string(),
      group: z.string(),
    })),
    error: z.string().nullable(),
  }),
});

export const webUiUrl = defineRpc({
  name: "magpie.webui",
  input: z.object({}),
  output: z.object({ url: z.string(), up: z.boolean() }),
});

export const quotaJson = defineRpc({
  name: "magpie.quota.json",
  input: z.object({}),
  output: z.object({ ok: z.boolean(), body: z.string(), error: z.string().nullable() }),
});

export const listAgents = defineRpc({
  name: "magpie.agents",
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    agents: z.array(z.object({
      name: z.string(),
      detail: z.string(),
      detected: z.boolean(),
    })),
    error: z.string().nullable(),
  }),
});

export const setAgentModel = defineRpc({
  name: "magpie.agent.setmodel",
  input: z.object({ agent: z.string(), model: z.string() }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const listGroups = defineRpc({
  name: "magpie.groups",
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    groups: z.array(z.object({ id: z.string(), raw: z.string() })),
    error: z.string().nullable(),
  }),
});

export const addGroup = defineRpc({
  name: "magpie.group.add",
  input: z.object({ name: z.string(), models: z.string(), routing: z.string().optional() }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const removeGroup = defineRpc({
  name: "magpie.group.rm",
  input: z.object({ id: z.string() }),
  output: z.object({ ok: z.boolean(), output: z.string(), error: z.string().nullable() }),
});

export const listModels = defineRpc({
  name: "magpie.models",
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    models: z.array(z.string()),
    error: z.string().nullable(),
  }),
});
