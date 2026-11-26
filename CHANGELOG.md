# Changelog

All notable changes to TTML Tool are listed here, newest first. The in-app
What's New window reads this file.

## [2.0.0] - 2026-11-26

### New

- Added the Studio workspace layer: a command palette (`Ctrl/Cmd+Shift+P`),
  workspace home (`Ctrl/Cmd+Shift+H`), review cockpit (`Ctrl/Cmd+Shift+Q`),
  focus mode (`Ctrl/Cmd+Shift+F`), workspace tabs, layout presets, a diff view,
  crash recovery, and rolling session backups.
- Added the New shell with a top bar, tab rail, command bar, and status bar laid
  out as one flex workspace. It measures its own chrome and handles overflow at
  narrow sizes and high display scaling. The Classic UI remains available.
- Added the 2.0 plugin platform: sandboxed WebAssembly importers, exporters, and
  tools; a reviewed Plugin Store with explicit permissions; Plugin Studio; and
  the public registry, schema, submission template, and validation workflow.
- Added Theme Studio, a searchable settings index, consistent settings page
  headers, and dedicated Themes and Performance pages.
- Added right-to-left interface support with automatic language detection and a
  manual direction override, plus a polite live-announcement region.
- Added ASS and VTT export with the existing export-loss report.

### Improved

- Preview, its progress bar, the bottom waveform, and the spectrogram now share
  one animation scheduler and a smoothed audio clock. Paused playback does no
  per-frame lyric work, unchanged style values are skipped, and scroll
  correction no longer forces layout every frame.
- Added Settings → Performance with adaptive visual quality, frame diagnostics
  and Copy frame report, and the opt-in, restart-gated Windows Unlimited
  frame-rate mode. Auto quality only removes decoration and never delays audio,
  input, or timing.
- Spectrogram zoom and pan easing is time-based, so it feels the same at 60,
  165, and 240 Hz.
- Added native menu and keyboard command entries for the new workspace actions.

### Fixed

- Retained the 1.0.4 waveform startup-crash fix so existing projects open
  normally.

## [1.0.4] - 2026-11-23

### Fixed

- Fixed the 1.0.3 startup crash where the audio waveform read
  `spectrogramVisibleAtom` without importing it, so the app stopped at "Oops, an
  error occurred" before the editor opened. The waveform now uses the shared
  spectrogram visibility context, which also keeps Review mode's spectrogram
  toggle separate from the main editor.

### Improved

- Preview animation now runs on one shared frame scheduler with a smoothed
  audio clock. The progress bar, waveform, and spectrogram follow the same
  loop, a paused preview does no per-frame lyric work, unchanged style values
  are skipped, and scroll correction no longer forces layout every frame.
- Added Settings → Performance with adaptive visual quality, a frame-time
  diagnostics overlay and Copy frame report, the existing Performance mode
  control, and a GPU troubleshooting note. Auto quality only removes visual
  effects and never delays audio, input, or timing.
- Added an opt-in, restart-gated Unlimited frame-rate mode for Windows. It
  passes extra WebView2 flags on the next launch and is marked experimental,
  because Microsoft warns that browser flags can change or disappear.
- Spectrogram zoom and pan easing is now time-based, so it feels the same at
  60, 165, and 240 Hz, and the shared loop avoids a second animation frame.

## [1.0.3] - 2026-11-23

### New

- Moved the fork onto the upstream TTML Editor 6.0.0 release while keeping the
  local feature set. Upstream additions include the Review workspace, censor
  words and clean TTML export, platform icons in the import dialog, and the
  updated surface and dialog theming.
- Added Tools → Review TTML and `Ctrl/Cmd+Shift+R`. The Review workspace pairs
  the editor with a live preview, syllable playback, word and section flags,
  writer credit checks, and Discord Markdown export.
- Added Tools → Search Bad Words & Clean Version, File → Save clean version, and
  Save clean TTML to clipboard. Clean exports preserve timestamps while
  replacing configured words.
- Added the 6.0.0 Review and censor actions to the native desktop menu and the
  keyboard command list.

### Improved

- Kept Mouse-free mode, the dyslexia-friendly font, Hand-off Summary, themes,
  the split library, the recycle bin, live rooms, the updater channel, and the
  fork's website and release pipeline.
- Merged the 6.0.0 translation keys with the fork's English and Chinese locale
  strings.
- Kept the Intel macOS runners for both macOS bundles so releases do not depend
  on the arm64 hosted runner pool.

### Fixed

- Resolved the merge conflicts across the app shell, menus, settings, audio
  controls, theme tokens, and website while preserving both feature sets.

## [1.0.2] - 2026-11-23

### New

- Added Mouse-free mode under Settings → General → Accessibility. Arrow keys
  move focus through the interface in reading order, Enter or Space activates
  the focused control, and Escape clears focus. Text fields, sliders, menus, and
  other arrow-key widgets keep their own behavior, and a status pill shows the
  mode is active with a button that turns it off.
- Added a dyslexia-friendly font option. It applies the bundled Atkinson
  Hyperlegible font to the interface and lyric editor with extra letter and word
  spacing, and works offline. Preview lyrics keep their own font.
- Added Tools → Hand-off Summary, which builds a Markdown snapshot of the open
  project with title, artist, file and audio names, timing coverage, song span,
  sections, open items, notes, and links. The summary can be copied or saved as
  a `.md` file and is generated locally.

### Improved

- Settings search now finds both accessibility options.

## [1.0.1] - 2026-11-21

### Release

- Rebuilt the release pipeline so Windows, macOS (Apple Silicon and Intel), and
  Linux x64 installers are produced from one tag, uploaded to a draft release,
  checked together, and published only after every installer and, when
  available, the updater manifest are present.
- Added a separate cross-platform build check for pull requests and pushes to
  `main`, so compile and frontend failures show up before a release tag.
- Prepared the downloader tools for each release target and pinned the Linux
  build to Ubuntu 22.04 for the Tauri v2 WebKitGTK 4.1 packages.

### New

- Added a community theme marketplace at
  <https://rimuruslimetempest.github.io/AMLL-TTML-TOOL/> with a validated
  registry, schema, three example themes, and an optional in-app browser that
  verifies each download's SHA-256 before the normal preview.
- Added a recycle bin for deleted lines, words, saved splits, themes,
  and projects. Deletions show an undo toast, and items can be restored for 7,
  30, or 90 days, or until the bin is emptied.
- Added yt-dlp version display, a verified updater, ffmpeg repair, custom tool
  paths, a cookies file option, playlist picking, and plain-language download
  errors to the desktop media downloader.
- Added installable themes for the New interface, with color schemes, optional
  CSS and local assets, a theme manager, a token editor, Custom CSS, import and
  export, and sixteen built-in themes. Themes are JSON and CSS only and never run
  code.
- Added glass, Mica, high-contrast, AMOLED, paper, terminal, and other built-in
  styles, plus a documentation file describing the theme format and safety
  rules.

### Improved

- Theme changes now flow through the shared design tokens, including dialogs,
  menus, settings, toasts, timestamp chips, and live-room panels. Accent,
  density, scale, and the Classic / New UI switch keep working as before.
- Glass effects are limited to interface chrome and automatically become flat
  colors in Performance mode, with reduced motion, or without backdrop-filter
  support.

### Fixed

- The installed app now finds its bundled yt-dlp, ffmpeg, and ffprobe tools, and
  release builds prepare them for each platform before packaging.
- The Preview lyrics display and scrolling were restored to the earlier stable
  version, and the later Preview-only rendering experiments were removed. The
  timeline ruler and blue waveform remain above the transport controls.
- Preview lyric scrolling no longer restarts its smooth-scroll animation on every
  frame. A seek jumps immediately, and a new lyric line starts one animation
  instead of being interrupted throughout playback.
- User-installed themes now appear in the theme gallery and can be applied
  without restarting the app.

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
