# Contributing to TTML Tool

Thanks for helping. Keep changes focused, tested, and easy to review.

## Setup

Use Node.js LTS, pnpm, and Rust/Cargo for desktop work. pnpm is required; do not use npm or Yarn.

```bash
pnpm install --frozen-lockfile
pnpm dev          # web app
pnpm tauri dev    # desktop app
```

Run a production build before opening a PR that changes UI, dependencies, configuration, or Tauri code:

```bash
pnpm build
```

## Project layout

- `src/components` contains shared UI.
- `src/modules` contains feature-specific UI and logic.
- `src/states` contains shared Jotai atoms.
- `src-tauri` contains the Rust/Tauri desktop app.
- `src/i18n/locales` contains translations.

Keep feature-local state in its module. Put state shared by unrelated features in `src/states`.

## Code and tests

- Add or update focused Vitest coverage for non-trivial behavior changes.
- Check only the files you changed:

  ```bash
  pnpm exec biome check <changed files>
  ```

- Do not run a broad formatter over unrelated files. Do not hand-edit `pnpm-lock.yaml`.
- Use the existing i18next pattern for new user-facing strings. Translation updates are managed through Crowdin; do not make bulk locale rewrites unless the change requires them.
- **Do not add automatic lyric timing.** All timing in TTML Tool is manual.

## Pull requests

Use a focused branch and explain what changed, why, and how you tested it. Include screenshots for visual changes and clear reproduction steps for bug fixes. Do not mix refactors with unrelated feature work.

Every user-visible feature or fix needs an entry in `CHANGELOG.md`. Keep entries ordered by user impact: features first, then fixes. A release tag should have a matching `## [X.Y.Z] - YYYY-MM-DD` heading; GitHub Release notes use that section.

## Marketplace submissions

The community marketplace lives in `docs/` and is served by GitHub Pages. Themes and plugins are separate catalogs with separate validators, reviewed by pull request.

### Theme submission

A theme submission adds three things:

1. `docs/registry/themes/<id>.json` — one theme file, JSON plus optional CSS, under 2 MB.
2. `docs/assets/previews/<id>.svg` (or `.png`, `.jpg`, `.webp`) — a 16:9 preview.
3. An entry in `docs/registry/themes.json` with the required fields and the SHA-256 of the exact theme file.

Themes are CSS and JSON only. Do not include JavaScript, HTML, remote fonts, or remote images; the validator and the in-app importer both reject them.

### Plugin submission

A plugin submission adds a WebAssembly bundle and one registry entry:

1. `docs/registry/plugins/<id>/plugin.wasm` — API 2.0 module, under 2 MB.
2. `docs/registry/plugins/<id>/plugin.json` — manifest with the same id, name, author, version, type, permissions, and slots as the registry entry.
3. An entry in `docs/registry/plugins.json` with the SHA-256 and byte size of the exact `plugin.wasm`.

See `PLUGINS.md` for the WASM contract, permission allowlist, and review rules.
Tool results must keep line and word IDs, order, and start/end times; the host
rejects timing or structural changes. The marketplace only lists WebAssembly plugins; it does not run arbitrary JavaScript, CSS, or HTML inside the app. Declared permissions must match the manifest, and every permission needs a reason in the pull request.

Run `node scripts/validate-marketplace.mjs` (or `pnpm validate:marketplace`) before opening the pull request. The **Validate marketplace submissions** workflow runs the same checks and fails on a missing field, a hash or size mismatch, a missing preview or manifest, a bad WASM header, an unknown permission, remote theme CSS, or script-like content. A maintainer reviews every entry, and nothing is published without a merge. Do not submit lyrics, audio, private project files, or credentials.

## Release checklist

Before tagging a release:

- [ ] `TAURI_SIGNING_PRIVATE_KEY` and its password, if any, are set in the
      repository's GitHub Actions secrets. Never commit or paste the key.
- [ ] `pnpm plugins:build`, `pnpm plugins:test`, and
      `node scripts/validate-marketplace.mjs` pass.
- [ ] `pnpm build` and the focused tests for the changed behavior pass.
- [ ] `README.md`, `CHANGELOG.md`, `RELEASE_NOTES.md`, `AGENTS.md`, the website
      badge, and the installer filenames all show the release version.
- [ ] A signed Windows installer is built locally when the key password is
      available, and the installed build is checked for version, two-tab undo,
      both official plugins, unchanged timings, and console errors.
- [ ] `main` has the public README and `docs/` marketplace if the Pages site
      should update for this release.

After tagging:

- [ ] The Release workflow uploads `.sig` files and `latest.json` and the
      verifier passes before publication.
- [ ] The published release page lists the installers and the updater files.
- [ ] Install over the previous release and confirm the updater sees the new
      version.

## Releases

Releases are maintainer-only and use stable Semantic Versioning (`X.Y.Z`).

1. Preview and apply the version bump:

   ```bash
   pnpm version:bump patch --dry-run
   pnpm version:bump patch
   ```

   Use `minor` or `major` when appropriate. This updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the app entry in `src-tauri/Cargo.lock`.
2. Add the matching `CHANGELOG.md` section and update the in-app changelog if needed.
3. Run the relevant tests, `pnpm exec biome check <changed files>`, and `pnpm build`.
4. Commit and push the version and changelog changes.
5. Create and push one matching tag: `git tag -a v2.1.0 -m "Release v2.1.0"` then `git push origin v2.1.0`.
6. Wait for the **Release** workflow. It builds Windows (NSIS and MSI), macOS (Apple Silicon and Intel), and Linux (AppImage, deb, and rpm), uploads them to a draft release, checks every installer plus the signed `.sig` files and `latest.json`, and only then publishes. For 2.1.0 and later, do not publish an installers-only release when the updater key is missing; fix the secret first, because old installs need the manifest. Check the **Verify and publish release** job before announcing the release.
7. If a draft release is incomplete after a transient failure, run the **Release** workflow manually with that tag or use **Re-run failed jobs**. A release that is already published cannot be overwritten; publish a new patch version instead. The **Build check** workflow runs the frontend and Rust checks on pull requests and `main` without creating a release.

Never reuse, move, or overwrite an existing release tag. Do not create release tags, change updater keys, or alter release endpoints without maintainer approval.