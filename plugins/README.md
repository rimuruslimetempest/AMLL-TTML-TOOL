# Official plugins

These are the first-party TTML Tool plugins. They are ordinary API 2.0
WebAssembly modules: no JavaScript, no DOM access, and no network access.

| Plugin | Kind | What it changes |
| --- | --- | --- |
| `whitespace-cleaner` | tool | Collapses repeated whitespace and removes zero-width characters. |
| `entity-decoder` | tool | Decodes named and numeric HTML entities. |

Both plugins are deliberately text-only. The host keeps every line and word
ID and every start/end time, and rejects a tool result that changes the
document structure or timing. A plugin cannot retime a song.

## Build

The build needs the `wasm32-unknown-unknown` target. This repository's local
stable toolchain is not usable, so the documented command pins the toolchain
that builds the desktop app:

```bash
RUSTUP_TOOLCHAIN=1.99.1 pnpm plugins:build
```

The script builds with `--locked`, so commit both `Cargo.lock` files whenever a
plugin dependency changes.

The script builds each crate, copies the module into `public/plugins/` for the
bundled app and `docs/registry/plugins/<id>/` for the marketplace, computes the
SHA-256, and regenerates:

- `src/modules/plugins/official-plugins.json`
- `docs/registry/plugins.json`

Run the Node-only smoke test after a build:

```bash
pnpm plugins:test
```

The test checks the published hashes, the WebAssembly header, the exported
ABI, the text transformation, and that every timestamp survives unchanged.

## Source layout

```text
plugins/<id>/Cargo.toml
plugins/<id>/plugin.json
plugins/<id>/src/lib.rs
```

The catalog at `plugins/catalog.json` is the single source for names,
descriptions, permissions, versions, and tags. Do not edit the generated
catalogs by hand; change the source catalog and rebuild.
