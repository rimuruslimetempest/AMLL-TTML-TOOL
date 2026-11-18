# Changelog

All notable changes to TTML Tool are listed here, newest first. The in-app
What's New window reads this file.

## [Unreleased]

### Fixed

- Preview artwork backgrounds are prepared once as a small, blurred, dimmed
  image instead of running a full-screen CSS filter or scaling the original
  artwork during playback. Lyrics stay readable over the darker background.
- Preview line positions are measured only when the lyric data or window size
  changes. The track is no longer measured on every line change, so active
  lines no longer cause a synchronous layout spike.
- Lyric spacing is reserved consistently, inactive words no longer shrink, the
  active line no longer grows, and the bottom of the lyric area now has enough
  padding and fade space for the last line. The FPS badge moved out of the
  lyrics to the top-right corner.
- The FPS overlay now records slow frames over 33 ms with loop-section timings,
  long-task observations, and heap deltas. Copy frame report copies the last
  50 slow frames for diagnosis.
- The blue waveform and timeline ruler are visible above the transport controls
  again. A static canvas fallback keeps the waveform visible even when the
  WaveSurfer canvas does not paint, and the playhead follows the shared Preview
  clock without another animation loop. A Waveform quality setting and a
  low-resolution Performance mode waveform were added.

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
- A first-run setup wizard and a smoother Preview with a shared playback clock.

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
- Preview quality and frame-rate cap settings, plus Performance mode.
- Portable settings and project backup, Discord Rich Presence, and an optional
  yt-dlp/FFmpeg media downloader.

### Improved

- The Preview uses one shared smoothed playback clock and one animation loop.
  The lyric block scrolls with a transform, the active line is tracked with a
  moving pointer, and finished lines are left in a static state instead of being
  restyled every frame.
- The Preview keeps working with translation, romanization, duet lines,
  background vocals, fullscreen, album artwork, and playback speeds below and
  above 1×.
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
- Pausing, seeking, and switching modes no longer leave the Preview clock or
  animation loop running in the background.

### Credits

- Made by Rimurulover — https://github.com/rimuruslimetempest
- TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
  notices are retained in LICENSE and the source-file headers.
