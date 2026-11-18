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
5. Create and push one matching tag: `git tag -a v1.0.0 -m "Release v1.0.0"` then `git push origin v1.0.0`.
6. Wait for the **Release** workflow. It builds Windows (NSIS and MSI), macOS (Apple Silicon and Intel), and Linux (AppImage, deb, and rpm), then publishes the installers and `latest.json`. Check the workflow's **Verify published assets and latest.json** job before announcing the release.
7. To rebuild a tag after a transient failure, run the **Release** workflow manually and enter the existing tag. Do not move or recreate a tag that has already been announced; publish a new patch version instead.

Never reuse, move, or overwrite an existing release tag. Do not create release tags, change updater signing keys, or alter release endpoints without maintainer approval.