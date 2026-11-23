# TTML Tool 1.0.3

TTML Tool is a desktop editor for word-synced TTML lyrics. This release moves
the fork onto the upstream TTML Editor 6.0.0 codebase while keeping the fork's
accessibility, collaboration, theme, and release features.

All timing is manual. The editor, the importers, and the text tools never create,
move, or retime a timestamp on their own.

## What's new in 1.0.3

- **Review workspace.** Open Tools → Review TTML or press `Ctrl/Cmd+Shift+R`.
  Review pairs the editor with a live preview, syllable-accurate playback, word
  and section flags, writer credit checks, and one-click Discord Markdown
  export. This is the upstream 6.0.0 Review mode, not the old fork reviewer.
- **Censor words and clean TTML export.** Tools → Search Bad Words & Clean
  Version configures the word list. File → Save clean version and Save clean
  TTML to clipboard export the project with timestamps intact. The native
  desktop menu exposes the same actions.
- **Platform icons in Import.** Apple Music, Genius, Spotify, QQ Music, NetEase,
  Kugou, Kuwo, JOOX, Musixmatch, and LRCLIB now use dedicated vector marks in
  the import dialog.
- **Updated 6.0.0 visual system.** Surface and dialog color harmonization,
  spectrogram visibility handling, and the rest of the upstream theme polish are
  included. The fork's installable theme system continues to apply to the New
  interface.
- **Everything from 1.0.2.** Mouse-free mode, the bundled Atkinson Hyperlegible
  dyslexia-friendly font, and the local Hand-off Summary are still available.

## Downloads

| Platform | File |
| --- | --- |
| Windows x64 | `TTML-Tool_1.0.3_x64-setup.exe` or `TTML-Tool_1.0.3_x64.msi` |
| macOS Apple Silicon | `TTML-Tool_1.0.3_aarch64.dmg` |
| macOS Intel | `TTML-Tool_1.0.3_x64.dmg` |
| Linux x64 | `TTML-Tool_1.0.3_amd64.AppImage`, `.deb`, or `.rpm` |

The Windows, macOS Apple Silicon, macOS Intel, and Linux x64 builds are uploaded
to the same draft release and checked before publication. On Linux, the AppImage
updates itself; use your package manager for `.deb` and `.rpm`.

## Highlights

- **One release for every desktop platform.** Windows x64 NSIS and MSI, macOS
  Apple Silicon and Intel DMGs, and Linux AppImage, DEB, and RPM packages are
  built from the same tag.
- **Upstream 6.0.0 plus the fork.** The Review workspace, censor tools, clean
  export, platform icons, and theme updates are combined with Mouse-free mode,
  the dyslexia-friendly font, Hand-off Summary, themes and marketplace, the
  split library, the recycle bin, live rooms, the custom updater channel, and
  the fork's branding.
- **Manual editing stays manual.** Line, word, and syllable timing, waveform and
  spectrogram tools, undo and redo, autosaves, restore points, and the stable
  Preview are unchanged.
- **The existing release pipeline.** Both macOS bundles run on Intel hosted
  runners and cross-compile their targets, avoiding the arm64 runner queue.

## Fixed

- The merge conflicts across the app shell, menus, settings, audio controls,
  theme tokens, translations, and website were resolved so both feature sets
  remain available.
- The review workspace is included in the app shell, keyboard commands, native
  menu, settings search, and English locale.

## Credits

Made by **Rimurulover** — https://github.com/rimuruslimetempest

TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
notices are retained in `LICENSE` and the source-file headers. The upstream
TTML Editor 6.0.0 work is by Miles Chase and contributors. Spicy Lyrics,
SpotMatch, and the Prosodic syllabification engine are credited in Settings →
About.
