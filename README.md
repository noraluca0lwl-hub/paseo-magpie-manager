# paseo-magpie-manager

A [Paseo](https://paseo.sh) plugin that manages a local [magpie](https://github.com/yetone/magpie) gateway — providers, agents, routing groups and quotas — from any Paseo client, **including mobile**, styled 1:1 after magpie's own web UI (same tokens, same segmented view switch, same list cards).

```
Paseo app (desktop / mobile / web)          ← the panel, E2E-encrypted over Paseo's relay
        ↓ plugin RPC
magpie-manager server side (on the daemon host)
        ↓ spawns
magpie CLI (provider add/rm/set/test, groups, agents, quota --json)
        ↓ serves
magpie gateway at 127.0.0.1:3425
```

magpie is the backend; this plugin is the management front end.

## Features

- **Providers** — list / add (preset vendor or custom relay with base URL) / remove / test / replace key
- **Agents** — every agent CLI magpie detects on the host, its current model, set model
- **Groups** — routing groups (failover across models/providers): list / add / remove
- **Quota** — `magpie quota --json`, what's left on every plan and key
- Presets picker with all vendors magpie knows (77 rows, CN relays included)
- Light/dark, follows the Paseo theme; magpie web-UI design tokens throughout

## Install

```sh
paseo plugin add https://github.com/noraluca0lwl-hub/paseo-magpie-manager
```

Requirements on the daemon host:

- `magpie` CLI in `PATH` (or set `MAGPIE_BIN`), e.g. `curl -fsSL https://usemagpie.ai/install.sh | sh`
- `XDG_RUNTIME_DIR` set for the daemon's user if magpie runs as a systemd --user service (default `/run/user/0` is assumed for root)

Open any agent workspace → the **Magpie** panel (or ⌘K / Ctrl+K → "Magpie Manager").

## Configuration

| Env (daemon side) | Default | Purpose |
|---|---|---|
| `MAGPIE_BIN` | `/root/.local/bin/magpie` | Path to the magpie CLI |
| `XDG_RUNTIME_DIR` | `/run/user/0` | Needed by `magpie` when it talks to its systemd service |

## Development

```sh
npm install
npm run typecheck
paseo plugin reload magpie-manager
paseo plugin logs magpie-manager
```

Layout:

- `shared/contracts.ts` — RPC contracts (zod), the whole API surface
- `server/magpie-cli.ts` — spawns the magpie CLI, parses its output
- `index.server.ts` — RPC handlers
- `client/panel.tsx` — the panel: segmented views, modals, magpie web-UI styling
- `index.client.tsx` — panel + Command Center registration

## Notes

- The plugin parses magpie's human-readable CLI output where no JSON flag exists (`providers`, `agents`, `groups`). If a magpie update changes those formats, the parsers in `server/magpie-cli.ts` and `index.server.ts` are the place to follow upstream — that is this repo's update path, mirroring magpie releases.
- Keys are passed to the magpie CLI over the plugin RPC (E2E-encrypted by Paseo) and stored by magpie itself; this plugin keeps nothing.

## License

MIT
