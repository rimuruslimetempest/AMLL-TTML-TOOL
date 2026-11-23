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

## Theme submissions

The community marketplace lives in `docs/` and is served by GitHub Pages. A theme submission is a pull request that adds three things:

1. `docs/registry/themes/<id>.json` — one theme file, JSON plus optional CSS, under 2 MB.
2. `docs/assets/previews/<id>.svg` (or `.png`, `.jpg`, `.webp`) — a 16:9 preview.
3. An entry in `docs/registry/themes.json` with the required fields and the SHA-256 of the exact theme file.

Run `node scripts/validate-theme-registry.mjs` before opening the pull request. The **Validate theme submissions** workflow runs the same check and fails on a missing field, a hash mismatch, a missing preview, remote CSS loads, or script-like content. Themes are CSS and JSON only; do not submit plugins here. A maintainer reviews every entry, and nothing is published without a merge.

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
5. Create and push one matching tag: `git tag -a v1.0.3 -m "Release v1.0.3"` then `git push origin v1.0.3`.
6. Wait for the **Release** workflow. It builds Windows (NSIS and MSI), macOS (Apple Silicon and Intel), and Linux (AppImage, deb, and rpm), uploads them to a draft release, checks every installer and, when updater metadata is available, `latest.json`, and only then publishes. If the updater key is not configured, the workflow publishes the installers without updater metadata. Check the **Verify and publish release** job before announcing the release.
7. If a draft release is incomplete after a transient failure, run the **Release** workflow manually with that tag or use **Re-run failed jobs**. A release that is already published cannot be overwritten; publish a new patch version instead. The **Build check** workflow runs the frontend and Rust checks on pull requests and `main` without creating a release.

Never reuse, move, or overwrite an existing release tag. Do not create release tags, change updater keys, or alter release endpoints without maintainer approval.