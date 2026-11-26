# TTML Tool 2.0.0

TTML Tool 2.0 is the Studio release. It adds a workspace layer for larger
editing sessions, a rebuilt New UI shell, a WebAssembly plugin platform, Theme
Studio, right-to-left interface support, and the high-refresh performance work
from the 1.0.4 line. All lyric timing stays manual.

## New

### Studio workspace

- **Command palette** (`Ctrl/Cmd+Shift+P`) searches the app's commands and
  opens the matching workspace action without leaving the keyboard.
- **Workspace home** (`Ctrl/Cmd+Shift+H`) lists open workspace tabs and recent
  sessions, and can restore the last session after an interruption.
- **Review cockpit** (`Ctrl/Cmd+Shift+Q`) keeps the editor, preview, and review
  checks together for a focused pass over a song.
- **Focus mode** (`Ctrl/Cmd+Shift+F`) hides the surrounding chrome so the
  editor and preview get the whole window.
- **Workspace tabs, layout presets, and a diff view** make it practical to move
  between projects and compare a working copy with the saved version.
- **Crash recovery and rolling session backups** keep a dirty snapshot while
  you work, write a clean marker on a normal close, and offer to restore the
  last session after a crash.

### New shell

- The New UI now uses a real flex shell: a top bar, tab rail, command bar, and
  status bar around one growing workspace. Menus, popovers, and panels no
  longer sit on top of each other because of fixed positioning.
- The shell measures its own chrome and handles overflow, so it stays usable at
  narrow window sizes and at high display scaling.
- The Classic UI switch, keyboard shortcuts, themes, and the existing editor
  remain available.

### Plugin platform

- Plugins are sandboxed WebAssembly modules that can import a lyric format,
  export one, or transform lyric lines. They cannot inject JavaScript, read the
  page, or reach the network unless the host grants a declared permission.
- **Plugin Store** lists reviewed plugins from the public catalog and shows
  every requested permission before install. Installed plugins live in
  IndexedDB, not in the install folder.
- **Plugin Studio** builds and tests a manifest and module, with API version 2,
  a 2 MB module cap, and explicit `lyrics:read`, `lyrics:write`, `files:read`,
  `files:write`, `network`, `settings:read`, `ui:toolbar`, and `ui:panel`
  permissions.
- The repository now includes the plugin registry, JSON schema, submission
  template, marketplace validator, and a validation workflow.

### Themes and settings

- **Theme Studio** edits theme tokens, previews the result, and packages a
  theme without writing JavaScript.
- Settings has a searchable index, consistent page headers, and dedicated
  Themes and Performance pages. The existing theme storage keys and user theme
  folder are unchanged.

### Accessibility

- Right-to-left interface support follows the selected language automatically,
  with a manual LTR/RTL override, and sets the document language for screen
  readers.
- A polite live-announcement region reports workspace and command changes
  without moving focus.

### Formats

- Added ASS and VTT export, including the existing export-loss report so it is
  clear when per-word timing, roles, or TTML metadata cannot be stored.

## Improved

- Preview, its progress bar, the bottom waveform, and the spectrogram share one
  animation scheduler and a smoothed audio clock. Paused playback does no
  per-frame lyric work, unchanged style values are skipped, and scroll
  correction no longer forces layout every frame.
- Settings → Performance adds adaptive visual quality, a frame-time diagnostics
  overlay with Copy frame report, and the opt-in, restart-gated Windows
  Unlimited frame-rate mode. Auto quality only removes decoration and never
  delays audio, input, or timing.
- Spectrogram zoom and pan easing is time-based, so it feels consistent at 60,
  165, and 240 Hz.
- More workspace actions are available from the native menu and the keyboard
  command list, including the new palette, focus, home, and cockpit shortcuts.

## Fixed

- Retained the 1.0.4 fix for the waveform startup crash, so the app opens
  normally on 1.0.3 projects.

## Downloads

| Platform | File |
| --- | --- |
| Windows x64 | `TTML-Tool_2.0.0_x64-setup.exe` or `TTML-Tool_2.0.0_x64.msi` |
| macOS Apple Silicon | `TTML-Tool_2.0.0_aarch64.dmg` |
| macOS Intel | `TTML-Tool_2.0.0_x64.dmg` |
| Linux x64 | `TTML-Tool_2.0.0_amd64.AppImage`, `.deb`, or `.rpm` |

The Windows, macOS Apple Silicon, macOS Intel, and Linux x64 builds are checked
before publication. On Linux, the AppImage updates itself; use your package
manager for `.deb` and `.rpm`.

## Upgrade notes

- Projects, themes, and settings keep their existing formats and storage keys.
- Installing 2.0.0 over 1.0.x keeps local projects, saved splits, user themes,
  and the recycle bin in place.
- All timing remains manual. The editor, importers, text tools, and plugins
  never create, move, or retime a timestamp on their own.

## Credits

Made by **Rimurulover** — https://github.com/rimuruslimetempest

TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
notices are retained in `LICENSE` and the source-file headers. The upstream
TTML Editor 6.0.0 work is by Miles Chase and contributors. Spicy Lyrics,
SpotMatch, and the Prosodic syllabification engine are credited in Settings →
About.
