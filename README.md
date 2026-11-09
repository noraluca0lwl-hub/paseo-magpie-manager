# Magpie Manager — Paseo plugin (Windows-layout rebuild)

A Paseo React Native plugin for controlling Magpie on the **Paseo daemon host**.
Not a standalone website, iframe, or link to the phone's localhost.

## Architecture

Paseo desktop/mobile → plugin screen → authenticated Paseo RPC → server-only
Magpie HTTP session → local Magpie official API.

UI references: `yetone/magpie` commit `c7ebb6f8`, `internal/gui/assets/index.html`,
`app.css`, `app.js`; API reference: `internal/gui/api.go`, `providers.go`.
The UI is a native port, not a claim of pixel-identical rendering.

## Rebuild status

- Native Chinese navigation, Agent default page, breadcrumb, bottom settings.
- Narrow screens use a navigation drawer.
- Agent rows: actual connection status, model picker, details, connect/disconnect
  confirmation, profiles save/use.
- Providers: official preset list, custom relay, protocol selection, URL/key,
  model IDs, edit, test, delete confirmation; failed save retains input.
- Secondary pages currently expose bounded structured official data and are
  explicitly labelled **under reconstruction**; their official interactions are
  not implemented yet. This is not a complete reproduction of Magpie.
- No desktop/mobile screenshot acceptance yet.

## Setup

Install Magpie on the same host as Paseo and run its authenticated web service
on loopback (default `http://127.0.0.1:3430`). Configure the plugin server with:

- `MAGPIE_WEB_ORIGIN`: loopback Magpie origin.
- `MAGPIE_WEB_KEY`: that service's key, only in the daemon environment; or
  `~/.config/magpie/paseo-web-key` (chmod 600).

The key never goes into the client bundle. The server exposes only explicitly
allowlisted API paths; errors propagate to the panel.

Install as a Paseo plugin using the repository or its local directory. The
existing sidebar, full-screen and workspace entries remain Paseo registrations.

## Verification

```sh
npm run typecheck
node --experimental-strip-types tests/official-api.test.ts
paseo plugin reload magpie-manager
```

Tests cover server cookie login, concurrent sign-in, GET/POST, upstream errors
and rejection of paths outside the allowlist. They do not establish visual
parity or validate mutations of real Agent configuration.

A local `backup/pre-windows-rebuild-*` Git branch preserves the earlier UI.
