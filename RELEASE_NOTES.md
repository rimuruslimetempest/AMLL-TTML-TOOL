# TTML Tool 1.0.4

TTML Tool 1.0.4 is a patch release for the startup crash in 1.0.3.

## Fixed

- **The app opens again.** The 1.0.3 audio waveform referenced
  `spectrogramVisibleAtom` without importing it, so the app stopped at
  "Oops, an error occurred" before the editor appeared. The waveform now uses
  the shared spectrogram visibility context.
- **Review mode keeps its own spectrogram toggle.** Expanding or collapsing the
  spectrogram in Review no longer changes the main editor's audio panel, and
  the main editor's toggle stays independent.
- **No project or setting changes.** 1.0.4 uses the same project format,
  settings, themes, and local data as 1.0.3. Installing it over 1.0.3 keeps
  everything in place.

If 1.0.3 closes immediately on launch, download the 1.0.4 installer for your
platform. The in-app updater cannot help when the app cannot start.

## Downloads

| Platform | File |
| --- | --- |
| Windows x64 | `TTML-Tool_1.0.4_x64-setup.exe` or `TTML-Tool_1.0.4_x64.msi` |
| macOS Apple Silicon | `TTML-Tool_1.0.4_aarch64.dmg` |
| macOS Intel | `TTML-Tool_1.0.4_x64.dmg` |
| Linux x64 | `TTML-Tool_1.0.4_amd64.AppImage`, `.deb`, or `.rpm` |

The Windows, macOS Apple Silicon, macOS Intel, and Linux x64 builds are uploaded
to the same draft release and checked before publication. On Linux, the AppImage
updates itself; use your package manager for `.deb` and `.rpm`.

## Everything from 1.0.3

1.0.4 keeps the upstream TTML Editor 6.0.0 integration: the Review workspace,
censor words and clean TTML export, platform icons in Import, and the updated
theme surfaces. It also keeps the fork's Mouse-free mode, dyslexia-friendly
font, Hand-off Summary, themes and marketplace, split library, recycle bin, live
rooms, custom updater channel, and branding.

All timing remains manual. The editor, importers, and text tools never create,
move, or retime a timestamp on their own.

## Credits

Made by **Rimurulover** — https://github.com/rimuruslimetempest

TTML Tool began from the AMLL TTML Tool codebase; its copyright and license
notices are retained in `LICENSE` and the source-file headers. The upstream
TTML Editor 6.0.0 work is by Miles Chase and contributors. Spicy Lyrics,
SpotMatch, and the Prosodic syllabification engine are credited in Settings →
About.
