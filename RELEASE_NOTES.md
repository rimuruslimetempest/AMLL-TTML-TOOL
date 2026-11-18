# TTML Tool 1.0.0

TTML Tool is a desktop editor for word-synced TTML lyrics. This is the first
release published from this repository, and it ships for Windows, macOS, and
Linux.

All timing is manual. The editor, the importers, and the text tools never create,
move, or retime a timestamp on their own.

## Downloads

| Platform | File |
| --- | --- |
| Windows x64 | `TTML-Tool_1.0.0_x64-setup.exe` or `TTML-Tool_1.0.0_x64.msi` |
| macOS Apple Silicon | `TTML-Tool_1.0.0_aarch64.dmg` |
| macOS Intel | `TTML-Tool_1.0.0_x64.dmg` |
| Linux x64 | `TTML-Tool_1.0.0_amd64.AppImage`, `.deb`, or `.rpm` |

The release also includes `latest.json` for the built-in updater. On Linux, only
the AppImage install updates itself; use your package manager for `.deb` and
`.rpm`.

## Highlights

- **Manual TTML editing.** Line, word, and syllable timing with a waveform,
  spectrogram, millisecond fields, keyboard shortcuts, undo and redo, autosaves,
  and restore points.
- **Live rooms.** Host, Editor, Commenter, and Viewer roles, shared editing,
  chat, comments, review marks, history, restore points, and an optional shared
  split dictionary.
- **Saved splits and text tools.** A reusable split library with previews and
  notes, syllable splitting, word replacement, line merging, and duplicate
  cleanup.
- **A smoother Preview.** One shared playback clock, one animation loop, a
  transform-based lyric scroller, and less per-frame work on the lyric text.
  Preview options include Simple lyrics, Translation, Romanization, BG Follows
  Duet, Album Artwork, Fullscreen, Mask Obscene Words, and Show FPS.
- **More formats.** Import TTML, LRC, enhanced LRC, SRT, ASS/SSA, WebVTT, and
  plain text. Export TTML, LRC, enhanced LRC, SRT, and plain text. Every import
  has a preview with line counts and problems, and imported timing is marked for
  review instead of being trusted.
- **First-run setup and updates.** A short, skippable setup wizard for display
  name, appearance, audio output and tap key, performance mode, and privacy. The
  built-in updater checks this repository, shows release notes, and can skip a
  version.

## New

- Built-in updater with a daily check, top-bar banner, release-notes dialog,
  progress bar, install-and-restart, Help and Settings checks, Stable/Beta
  channels, and skip-this-version.
- Import previews with detected format, line count, and per-line warnings;
  imported lines marked needs review.
- Export dialog with format picker, inclusion options, preview, filename, and
  loss warnings.
- Drag-and-drop for lyric files and desktop file associations for `.ttml`,
  `.lrc`, and `.srt`.
- Seven-step setup wizard, reopenable from Settings → General.
- Live rooms with roles, chat, comments, review marks, history, restore points,
  and shared splits.
- Saved split library with previews, proportional timing, and notes.
- TTML Checklist, song-info metadata, portable backup, Discord Rich Presence,
  and the optional media downloader.
- Preview quality, frame-rate cap, Performance mode, and an FPS overlay with
  frame-time and React-render diagnostics.

## Improved

- Imported files are converted, not retimed. The editor is warned to check the
  result against the audio.
- The Preview uses one shared clock and animation loop, so only the active line
  and word update each frame.
- Pausing, seeking, and hiding the window stop the Preview loop instead of
  leaving it running.
- Update checks stay silent when offline, and all update preferences persist
  across restarts.
- Metadata, installer naming, the update endpoint, and every project link point
  at TTML Tool and this repository.
- The desktop app now uses TTML Tool's own application identifier and executable
  metadata. Because that creates a new local WebView profile, export a settings
  backup before switching from an older build.

## Fixed

- UTF-8 BOM, UTF-16, CRLF, and mixed line endings import correctly.
- Bad timestamps and unsupported ASS/SSA dialogue lines are reported in the
  preview instead of aborting the import.
- Non-TTML exports never modify the open project.
- The Preview no longer rebuilds every line's blur and shadow styles on every
  animation frame.

## Credits

Made by **Rimurulover** — https://github.com/rimuruslimetempest

TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
notices are retained in `LICENSE` and the source-file headers. Spicy Lyrics,
SpotMatch, and the Prosodic syllabification engine are credited in Settings →
About.
