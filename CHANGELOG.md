# Changelog

All notable changes to TTML Tool are listed here, newest first. The in-app
What's New window reads this file.

## [Unreleased]

### Fixed

- The Preview lyrics display and scrolling were restored to the earlier stable
  version, and the later Preview-only rendering experiments were removed. The
  timeline ruler and blue waveform remain above the transport controls.

## [1.0.0] - 2026-11-17

### Highlights

- First release of TTML Tool under the Rimurulover name, with Windows, macOS,
  and Linux builds and a built-in updater served from this repository.
- A manual TTML editor with line, word, and syllable timing, a waveform, a
  spectrogram, autosaves, restore points, and live preview.
- Live rooms with Host, Editor, Commenter, and Viewer roles, shared editing,
  chat, comments, review marks, history, and restore points.
- Import and export for common lyric and subtitle formats, with previews,
  warnings, and a needs-review flag for imported timing.
- A first-run setup wizard and a live Preview that follows the manual timing.

### New

- Built-in updater with a daily launch check, a Help menu and Settings check, a
  non-blocking top-bar banner, release notes, download progress, Stable and Beta
  channels, a skip-this-version option, and an automatic-check toggle.
- Import from TTML, LRC, enhanced LRC, SRT, ASS/SSA, WebVTT, and plain text,
  with format detection, encoding handling, a preview of the result, and
  per-line problems.
- Export to TTML, LRC, enhanced LRC, SRT, and plain text, with a format picker,
  inclusion options, a preview, a filename field, and a clear list of what the
  format loses.
- Drag-and-drop for lyric files, and desktop file associations for `.ttml`,
  `.lrc`, and `.srt`.
- Seven-step first-run setup covering the welcome, display name, appearance,
  audio output and tap key, performance mode, privacy choices, and a final
  summary. It can be reopened from Settings → General.
- Live rooms with Host, Editor, Commenter, and Viewer roles, shared editing,
  chat, comments, review marks, history, restore points, and an optional shared
  split dictionary.
- Saved split library with previews, proportional timing for words that already
  have timing, and per-word notes.
- TTML Checklist for keeping a local queue of songs and their progress.
- Song-info panel with songwriters, languages, streaming IDs, version notes,
  and a copy-ready metadata block.
- Preview options for Simple lyrics, Show Translation, Show Romanization,
  BG Follows Duet, Album Artwork, Fullscreen, Mask Obscene Words, and Show FPS.
- Preview FPS overlay and Performance mode.
- Portable settings and project backup, Discord Rich Presence, and an optional
  yt-dlp/FFmpeg media downloader.

### Improved

- The Preview follows playback with word and line highlighting and uses a
  transform for lyric scrolling. It keeps working with translation,
  romanization, duet lines, background vocals, fullscreen, album artwork, and
  playback speeds below and above 1×.
- Imported lines are marked "needs review" and a banner reminds the editor to
  check imported timing against the audio. No imported timing is retimed or
  merged.
- Update checks fail quietly when offline, and update settings are remembered
  across restarts.
- The interface has a shared appearance system with density, scale, accent,
  font, background, and Performance mode controls.
- Metadata, installer naming, the update endpoint, and project links identify
  TTML Tool and this repository.
- The desktop app now uses TTML Tool's own application identifier and executable
  metadata. Because that creates a new local WebView profile, export a settings
  backup before switching from an older build.

### Fixed

- Importing UTF-8 with a BOM, UTF-16 files, and mixed line endings no longer
  drops or corrupts lines.
- Malformed timestamps and unsupported dialogue lines are reported in the
  import preview instead of aborting the import.
- Exporting to a non-TTML format no longer modifies the open project.
- Pausing, seeking, and switching modes no longer leave the Preview animation
  loop running in the background.
- Preview lyrics were restored to the earlier stable display. The later
  Preview-only rendering experiments were removed.

### Credits

- Made by Rimurulover — https://github.com/rimuruslimetempest
- TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
  notices are retained in LICENSE and the source-file headers.
