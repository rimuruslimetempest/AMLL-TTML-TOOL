# TTML Tool 1.0.1

TTML Tool is a desktop editor for word-synced TTML lyrics. This release brings
the Windows, macOS, and Linux builds back onto one release, all from the same
tagged source.

All timing is manual. The editor, the importers, and the text tools never create,
move, or retime a timestamp on their own.

## Downloads

| Platform | File |
| --- | --- |
| Windows x64 | `TTML-Tool_1.0.1_x64-setup.exe` or `TTML-Tool_1.0.1_x64.msi` |
| macOS Apple Silicon | `TTML-Tool_1.0.1_aarch64.dmg` |
| macOS Intel | `TTML-Tool_1.0.1_x64.dmg` |
| Linux x64 | `TTML-Tool_1.0.1_amd64.AppImage`, `.deb`, or `.rpm` |

When updater metadata is generated, the release also includes `latest.json` for
the built-in updater. On Linux, the AppImage updates itself; use your package
manager for `.deb` and `.rpm`.

## Highlights

- **One release for every desktop platform.** The Windows, macOS Apple Silicon,
  macOS Intel, and Linux x64 builds are uploaded to the same draft release and
  checked before the release is published.
- **Manual TTML editing.** Line, word, and syllable timing with a waveform,
  spectrogram, millisecond fields, keyboard shortcuts, undo and redo, autosaves,
  and restore points.
- **Live rooms.** Host, Editor, Commenter, and Viewer roles, shared editing,
  chat, comments, review marks, history, restore points, and an optional shared
  split dictionary.
- **A stable Preview.** Word and line highlighting, a transform-based lyric
  scroller, duet and background-vocal layout, and options for Simple lyrics,
  Translation, Romanization, BG Follows Duet, Album Artwork, Fullscreen, Mask
  Obscene Words, and Show FPS.
- **More formats.** Import TTML, LRC, enhanced LRC, SRT, ASS/SSA, WebVTT, and
  plain text. Export TTML, LRC, enhanced LRC, SRT, and plain text. Every import
  has a preview with line counts and problems, and imported timing is marked for
  review instead of being trusted.
- **Themes and the marketplace.** Install a JSON/CSS theme, edit its tokens, or
  browse the community marketplace. Themes never run code and are not applied
  without a preview.
- **A 30-day recycle bin.** Deleted lines, words, saved splits, themes, and
  projects can be restored for 7, 30, or 90 days, or until the bin is emptied.

## Release changes

- The release workflow now creates a draft first and uploads all platform
  bundles to it. It verifies the installers and, when updater metadata is
  available, the update files and `latest.json` before publishing, so a failed
  platform cannot produce a half-empty public release.
- The downloader tools are prepared separately for Windows x64, macOS Apple
  Silicon, macOS Intel, and Linux x64. This keeps yt-dlp, FFmpeg, FFprobe, Deno,
  and cloudflared matched to the computer that runs the app.
- Linux releases are built on Ubuntu 22.04 with the Tauri v2 WebKitGTK 4.1
  packages, and AppImage bundling uses the extract-and-run path on the runner.
- A separate build check runs the frontend build and `cargo check` on pull
  requests and pushes to `main` without creating a release.

## Fixed

- The workflow validates its release settings once before creating a draft and
  reports missing updater metadata instead of leaving a half-built public
  release. Installers are still published when that metadata is unavailable.
- A published release is never overwritten by the workflow. Use a new patch
  version for a new build.
- The Linux job installs the complete Tauri v2 dependency set, including the
  AppImage runtime support, instead of relying on the runner's default packages.
- The macOS Intel build explicitly installs the `x86_64-apple-darwin` Rust
  target and builds with that target, so it is not mistaken for an Apple Silicon
  build.

## Credits

Made by **Rimurulover** — https://github.com/rimuruslimetempest

TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
notices are retained in `LICENSE` and the source-file headers. Spicy Lyrics,
SpotMatch, and the Prosodic syllabification engine are credited in Settings →
About.
