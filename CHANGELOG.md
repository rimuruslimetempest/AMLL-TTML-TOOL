# Changelog

All notable changes to this app are listed here, newest first. Edit this file
to update the in-app What's New window and Changelog.

## [4.10.0] - 2026-11-06

### Added

- Personal split library: save several split patterns per word, search, rename, note, choose a default, and import or export the whole library as JSON.
- Apply saved splits to a whole song with a preview, proportional timing for already timed words, and every changed word marked for review.
- A small "Apply saved split" suggestion when one word with a saved pattern is selected, plus the Ctrl+Shift+J shortcut.
- Song info panel with links, Spotify IDs, songwriters, languages, version notes, the exact version timed, free-form notes, and a status line.
- "Copy song info" builds a clean text block for submission messages.
- Clipboard timing commands: copy line timing, paste with an optional offset, paste relative to the playhead or line start, and match-by-position or stretch-to-fit previews.
- Line text clipboard commands: copy line text, copy a line with timing, paste as a new line after the selection, and paste text into a line.
- Shared split dictionary in live rooms, with author names, optional notes, conflicts shown side by side, host removal, and export to the personal library.
- What's New and Changelog now read from the bundled `CHANGELOG.md` file.
- Help and About now include Releases (when configured) and Report a problem links.

### Improved

- Split provenance is recorded and shown, distinguishing hand splits, library splits, room suggestions, and Auto Segment.
- Splits from the library never change spelling; only the existing text is divided.
- Paste operations are a single undo step and are refused on lines another person is editing.
- Song info is shared with the room document, but links, notes, and status are never written into exported TTML.
- Room split browsing is limited to commenter access or higher; adding and removing are enforced by both the client and the relay (editors add, only the host removes).
- The Privacy Policy and live-room consent text now describe shared splits and song info.

### Fixed

- Large songs stay responsive: split lookups use an index, previews cap their rendered rows, and the clipboard keeps only one payload.
- Copying timing no longer depends on a line remaining selected after the copy.

## [4.9.0] - 2026-11-05

### Added

- Compact line properties, double-click inline editing for translations and romanizations, reorderable songwriters, and improved Spotify matching.
- SpotMatch alternate Spotify IDs, Genius link resolution, and the refreshed New and Classic interfaces.

### Improved

- Collaboration panels, review marks, and history restore flow.
- TTML Checklist and submission workflow.

### Fixed

- Various timing, import, and export edge cases.
