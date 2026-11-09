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
  Custom protocol tabs: OpenAI Chat, Responses, Anthropic, Gemini and System One.
  Unsaved model-list fetch with selection, protocol detection with optional test
  model, and key show/hide are wired to official endpoints. Detection results
  currently render as JSON rather than the Windows result grid. Advanced/more
  endpoint fields, image picker and built-in icon picker remain pending.
  Provider icons render from official assets or stored pictures via authenticated
  server RPC as data URIs (no phone-localhost URLs). Custom relays have a name
  tile fallback, icon preview and explicit site-favicon fetch/reset controls.
  Save preserves icon/iconFrom; desktop-light/mobile-dark preview tests verify
  rendering and save payload. Native image-format compatibility remains unverified.
- Secondary pages now have dedicated session/resource/group/upstream/quota/
  masking/plugin/settings layouts. Each page explicitly lists its missing
  interactions. This is not a complete reproduction of Magpie.
- Library: shared instructions and Agent-specific appended text, current-set
  editing, Agent distribution selection, MCP stdio/http/sse editor with JSON
  arguments/env/headers, save/distribution confirmation and server removal.
  Upstream partial-distribution problems are surfaced; failed saves retain input.
  Skills: SKILL.md read/edit with optimistic concurrency (`was`), Agent distribution.
  Hooks: create/edit event, matcher, command, timeout and distribution targets.
  Subagents: create/edit description, prompt, model and distribution targets;
  explicit skill/MCP selection with existing advanced fields preserved.
  Skills/hooks/subagents have resource-removal confirmation, with failed removal
  keeping the confirmation open. Skill installation supports source probing,
  candidate selection (already-installed entries disabled), Agent selection and
  confirmation. Single-skill updates require explicit replacement confirmation
  for known local edits; removed upstream skills are reported as not updated.
  Skill editor now lists official text files and caches per-file drafts when
  switching; modified files save sequentially with their own `was` values.
  Successful writes are marked saved before retrying remaining files; closing
  dirty skill drafts requires discard confirmation. Multi-file draft switching
  and discard/cancel were checked at desktop/mobile light/dark sizes.
  Instruction set management remains pending.
  Desktop/mobile light/dark browser tests cover editor opening and failed-write
  input retention; no real Agent mutations were performed.
  Browser tests blocked real writes; actual Agent distribution is not yet verified.
- Sessions: title/working-directory search, Agent filtering, transcript reader,
  user/assistant/tool messages, in-conversation search, retry, cancellation of
  stale reads and selectable resume command. Image attachments, export and
  executing resume remain pending. Browser tests used explicit fixture sessions;
  the local official sessions list was empty.
- Routing groups: add/edit/delete and template creation via official endpoints;
  preserves advanced group properties while editing basic fields.
- Quotas: balance, allowance windows, used-percentage bars, reset time and
  per-account refresh. Full request statistics remain pending.
- Browser regression verified failed routing save retains the input and mobile
  routing editor has no horizontal overflow; writes were blocked in the preview.
- Official SVGs for the bird, Claude Code, Codex, Pi, Hermes, library and settings.
- Appearance: follow Paseo / light / dark, persisted server-side in
  `~/.config/magpie/paseo-panel.json`, independent of Magpie's own theme.
- React Native Web preview checked at 1440×1000 and 390×844: navigation, theme
  switching, drawer and model picker; zero page errors or mobile horizontal
  overflow. Preview uses a stub Paseo RPC transport and blocks configuration
  mutations. Actual Paseo desktop/mobile acceptance remains pending.

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
