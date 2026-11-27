# TTML Tool 2.1.1

2.1 makes the 2.0 workspace dependable, and 2.1.1 rebuilds the Preview lyric
list around measured virtual rows. The Plugin Store now opens with two reviewed
first-party plugins, tool plugins can change text but never timing, undo is
scoped to the open document, and this is the first release with signed updater
artifacts and `latest.json`. All lyric timing stays manual.

## New

### A Plugin Store with real plugins

- **Whitespace Cleaner** collapses repeated whitespace and removes zero-width
  characters without joining separate words.
- **HTML Entity Decoder** turns `&amp;`, `&#39;`, and numeric entities back into
  the characters they represent.
- Both plugins are bundled with the app, so they appear in the store even when
  the public marketplace is offline or stale. They are text-only tools and also
  appear in the plugin toolbar.
- Every store entry shows its permissions and SHA-256 before install. Plugins
  stay ordinary WebAssembly modules; they cannot inject JavaScript or read the
  page.

### Timing stays yours

- Tool results must keep the same line and word IDs, the same line and word
  order, and every start/end time. The host rejects a retimed or structurally
  changed document with a clear error instead of applying it.
- Importers and exporters keep their existing behavior. The guard applies where
  a plugin tool claims to edit the current lyrics.
- All timing remains manual. No plugin can create, move, or retime a word.

### Safer workspace tabs

- Loading a project or activating another workspace tab now resets the lyric
  undo/redo history. Undo in project B can no longer restore project A's lyrics.
- The existing dirty-tab close confirmation and multi-tab workflow are
  unchanged.

## Improved

### A faster Preview for long songs

- The Preview lyric list now mounts only the rows around the viewport and
  measures each row once, following the measured-virtual-row model from Spicy
  Lyrics. Scroll-follow, blur, and word gradients read the same measured
  offsets instead of walking the whole document.
- On a 120-line word-synced test file the median frame rate rose from about
  34 FPS to 65–79 FPS, and the rendered DOM fell from about 1,330 to under 800
  nodes. Short songs get the same treatment with less to mount.
- Seeking, paused seeks, manual scrolling, and background-vocal groups re-aim
  the follow at the correct measured row, and word highlighting resumes from
  the right gradient after a seek.
- Store downloads resolve the documented marketplace-relative paths correctly,
  including the public Pages catalog and the app-local official catalog.
- The store merges bundled official plugins with the fetched catalog, so a
  stale public registry cannot hide them.
- Importers, exporters, and tools are listed from the actual WebAssembly
  exports, so a tool-only plugin no longer appears as an importer or exporter.
- `network`, `settings:read`, and `ui:panel` are labelled reserved until a
  later plugin API implements them.
- Plugin tool failures now show a toast as well as a console error.

## Downloads

| Platform | File |
| --- | --- |
| Windows x64 | `TTML-Tool_2.1.1_x64-setup.exe` or `TTML-Tool_2.1.1_x64.msi` |
| macOS Apple Silicon | `TTML-Tool_2.1.1_aarch64.dmg` |
| macOS Intel | `TTML-Tool_2.1.1_x64.dmg` |
| Linux x64 | `TTML-Tool_2.1.1_amd64.AppImage`, `.deb`, or `.rpm` |

The Windows, macOS Apple Silicon, macOS Intel, and Linux x64 builds are checked
before publication. On Linux, the AppImage updates itself; use your package
manager for `.deb` and `.rpm`.

## Updating from 1.0.4 or 2.0.0

This is the first release with a working updater manifest. Releases 1.0.4 and
2.0.0 never published `latest.json`, so an installed copy cannot discover 2.1.1
on its own. Install 2.1.1 once from the release page; after that, the built-in
updater can find later releases automatically. Copies installed from the local
2.1.0 test build can update the same way.

Projects, saved splits, user themes, installed plugins, settings, and the
recycle bin keep their existing formats and storage keys. The plugin manifest
and WebAssembly ABI are unchanged from 2.0.0.

## Credits

Made by **Rimurulover** — https://github.com/rimuruslimetempest

TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
notices are retained in `LICENSE` and the source-file headers. The upstream
TTML Editor 6.0.0 work is by Miles Chase and contributors. Spicy Lyrics,
SpotMatch, and the Prosodic syllabification engine are credited in Settings →
About.
