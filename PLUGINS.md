# Plugins

TTML Tool plugins are WebAssembly modules. A plugin can import a lyric format,
export one, or transform lyric lines. It cannot inject JavaScript into the
editor, read the page, or call the network unless the host grants a declared
permission.

The marketplace lists reviewed plugins from `docs/registry/plugins.json`. The
app loads that registry only when you open **Plugin Management → Plugin Store**.

## Official plugins

The app bundles two first-party text-only tools: **Whitespace Cleaner** and
**HTML Entity Decoder**. Their source lives in `plugins/`, and the built
modules are copied to both `public/plugins/` for the app and
`docs/registry/plugins/` for the marketplace. The Plugin Store merges them with
the fetched catalog, so they remain available when the public page is offline
or stale. Build and test them with `pnpm plugins:build` and
`pnpm plugins:test`; see `plugins/README.md`.

## Where plugins live

Installed plugins are stored in IndexedDB, not in the install folder. Deleting
the app does not delete them; remove a plugin from the Installed tab.

A marketplace bundle is two files:

```text
docs/registry/plugins/<id>/
  plugin.wasm
  plugin.json
```

The module is capped at 2 MB. The manifest is metadata only; it is never
executed.

## Manifest: `plugin.json`

```json
{
  "id": "lyric-normalizer",
  "name": "Lyric Normalizer",
  "description": "Trims stray spaces and normalizes word order in tool runs.",
  "author": "your-github-name",
  "version": "1.0.0",
  "type": "tool",
  "apiVersion": 2,
  "permissions": ["lyrics:read", "lyrics:write"],
  "slots": [],
  "homepage": "https://github.com/you/lyric-normalizer",
  "techniques": ["Normalize whitespace"],
  "usage": "Run it from the plugin list after selecting a project."
}
```

`type` is `importer`, `exporter`, `tool`, or `both`. `apiVersion` must be `2`.
`techniques` and `usage` are optional card text.

## WebAssembly contract

The module must export linear `memory` and:

| Export | Required | Signature |
| --- | --- | --- |
| `allocate` | yes | `(size: i32) -> i32` |
| `deallocate` | no | `(ptr: i32, size: i32) -> void` |
| `run_importer` | for importers | `(ptr: i32, len: i32) -> i32` |
| `run_exporter` | for exporters | `(ptr: i32, len: i32) -> i32` |
| `run_tool` | for tools | `(ptr: i32, len: i32) -> i32` |

The host writes a UTF-8 string into memory at the pointer returned by
`allocate`, then calls the relevant `run_*` export. The export returns a pointer
to a NUL-terminated UTF-8 result string. `run_tool` receives and returns the
JSON encoding of the lyric lines.

The host imports one function:

```text
env.log(ptr: i32) -> void
```

`log` reads a NUL-terminated string from the module's memory and writes it to
the console with the plugin name. Do not log lyric content.

### Timing and structure

A `run_tool` result must keep the same line count and order, the same word
count and order within each line, every line and word `id`, and every
`startTime` and `endTime`. The host compares the result with the document it
sent and rejects any change with a clear error. A tool can edit text, but it
cannot retime a project or add, remove, reorder, or replace a line or word.

## Permissions

Declare only what the module uses. The full allowlist:

| Permission | Meaning |
| --- | --- |
| `lyrics:read` | The host may pass lyric lines to the plugin. |
| `lyrics:write` | The host may replace lyric lines with the plugin's result. |
| `files:read` | The plugin appears in file-open flows. |
| `files:write` | The plugin appears in save/export flows. |
| `network` | Reserved. A module cannot fetch on its own and the host does not proxy requests in 2.1. |
| `settings:read` | Reserved. The host does not pass settings in 2.1. |
| `ui:toolbar` | The plugin may add a toolbar action. |
| `ui:panel` | Reserved. Side panels are not implemented in 2.1. |

Declaring a permission does not grant it silently: the store shows every
permission before install and the user must approve. The reserved permissions
are shown as "(reserved)" and have no effect in 2.1. A plugin that declares
`network` or `files:write` gets extra review.

## Registry entry

Add one object to `docs/registry/plugins.json`:

```json
{
  "id": "lyric-normalizer",
  "name": "Lyric Normalizer",
  "author": "your-github-name",
  "version": "1.0.0",
  "description": "Trims stray spaces and normalizes word order in tool runs.",
  "tags": ["lyrics", "tool"],
  "type": "tool",
  "apiVersion": 2,
  "permissions": ["lyrics:read", "lyrics:write"],
  "slots": [],
  "download": "registry/plugins/lyric-normalizer/plugin.wasm",
  "sha256": "<64 lowercase hex characters>",
  "size": 24576,
  "minAppVersion": "2.1.0",
  "addedAt": "2026-11-24",
  "verified": false
}
```

Compute the hash and size from the exact file you commit:

```bash
node -e "const {readFileSync}=require('node:fs');const {createHash}=require('node:crypto');const b=readFileSync('docs/registry/plugins/lyric-normalizer/plugin.wasm');console.log(createHash('sha256').update(b).digest('hex'), b.byteLength)"
```

`verified` is set by the maintainer after review, not by the author.
`deprecated` can be set later to warn users without touching installed copies.

## Review rules

- The module is built from the linked public source and the committed binary
  matches that source build.
- Every permission and slot is justified by the plugin's behavior.
- The manifest, registry entry, and module agree on id, name, author, version,
  and type.
- The plugin does not attempt to fetch remote code, hide files, or write outside
  the provided lyric data.
- A tool returns the same line and word structure and timing it received. It
  may edit `word` text only.
- No lyrics, audio, credentials, or private project data are committed.
- The SHA-256 matches the exact committed module.

Run `node scripts/validate-marketplace.mjs` (or both validator scripts) before
opening the pull request. For the bundled official plugins, also run
`pnpm plugins:test`. A maintainer reviews the entry; merging publishes it.

## Security boundary

WebAssembly runs inside the app's process, so the host controls every import.
The marketplace does not run arbitrary JavaScript or CSS from plugins. Themes
are separate and remain CSS/JSON only. A plugin cannot access the DOM, Tauri
commands, local storage, or the network directly.
