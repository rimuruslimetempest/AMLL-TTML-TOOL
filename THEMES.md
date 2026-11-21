# Themes

TTML Tool has an installable theme system for the New interface. A theme is a
folder of JSON and CSS: it can change the app's design tokens and add extra CSS,
but it cannot run JavaScript or inject HTML.

Themes apply to the New UI only. Classic keeps its existing colors, and the
Classic / New UI switch, density, UI scale, accent picker, and Performance mode
still work exactly as before. A theme can provide light and dark schemes; the
"Follow app theme" choice follows the app's existing light/dark preference.

## Where themes live

User themes are stored in the Tauri application-data directory, inside a fixed
`themes` folder. The folder is deliberately independent of the installed app
version, so updating TTML Tool does not delete your themes.

| Platform | Typical folder |
| --- | --- |
| Windows | `%APPDATA%\com.rimuruslimetempest.ttmltool\themes` |
| macOS | `~/Library/Application Support/com.rimuruslimetempest.ttmltool/themes` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/com.rimuruslimetempest.ttmltool/themes` |

Each theme gets its own subfolder named after its id:

```text
themes/
  my-theme/
    theme.json
    theme.css        (optional)
    background.jpg   (optional local asset)
```

The exact AppData location can be redirected by the operating system. The app
uses Tauri's AppData base directory, the same base it already uses for
`split-library.json`; it does not hardcode a user path.

In the browser development build there is no AppData folder, so installed user
themes are kept in `localStorage` under `ttml_user_themes_v1`. Theme selection
and settings use their own `ttmlTheme*` keys; do not rename those keys without a
migration.

## Manifest: `theme.json`

```json
{
  "format": 1,
  "id": "my-theme",
  "name": "My Theme",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "A short description shown in the theme manager.",
  "schemes": [],
  "effects": { "level": "none", "performance": "light", "gpu": false },
  "nativeEffect": "none",
  "minAppVersion": "1.0.0",
  "css": "/* optional, for single-file sharing only */"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `format` | Yes | Must be `1`. |
| `id` | Yes | Lowercase letters, numbers, and dashes; 2–64 characters. Built-in ids are reserved. |
| `name` | Yes | Display name, up to 80 characters. |
| `author` | Yes | Up to 120 characters. |
| `version` | Yes | Semantic version such as `1.0.0`. |
| `description` | Yes | Up to 600 characters; shown before install. |
| `schemes` | Yes | At least one color scheme. |
| `effects` | No | `level`: `none`, `light`, `medium`, or `heavy`; `performance`: `light`, `medium`, or `heavy`; `gpu`: boolean. |
| `nativeEffect` | No | `none`, `mica`, or `acrylic`. This build uses Mica on Windows 11; other values fall back to the solid scheme. |
| `minAppVersion` | No | Semantic version recorded with the theme. Keep it accurate for future compatibility. |
| `css` | No | Embedded CSS for a single `.json` file. A separate `theme.css` is preferred for folders and zips. |

Malformed JSON, unknown required values, reserved ids, missing tokens, and
unsafe CSS color values are rejected before installation. HTML tags are not
accepted in text fields.

## Color schemes

A theme can contain several schemes. `appearance` tells the app whether the
scheme is `dark` or `light`; the app picks the matching scheme when the user
chooses "Follow app theme". A scheme id such as `dark`, `light`, or `midnight`
can be selected explicitly in the theme card.

```json
{
  "id": "dark",
  "name": "Dark",
  "appearance": "dark",
  "tokens": {},
  "flatTokens": {}
}
```

`flatTokens` is optional. It is used when effects are disabled (Performance
mode, "Reduce effects", reduced motion, or a PC without backdrop-filter), so a
glass theme can keep readable opaque panels without changing its normal look.

### Token reference

All values must be CSS colors that pass the theme sanitizer. `rgba()`,
`color-mix()`, and ordinary hex colors are accepted; arbitrary CSS is not.

| Token | What it controls |
| --- | --- |
| `bgBase` | App and workspace background. |
| `bgRaised` | Raised background; title bar and sidebars. |
| `bgOverlay` | Dialogs, popovers, and overlays. |
| `surface` | Standard panel surface. |
| `surface2` | Secondary cards and inputs. |
| `surface3` | Pressed or deeper surfaces. |
| `surfaceHover` | Hover background. |
| `border` | Normal border. |
| `borderStrong` | Focused, selected, or emphasized border. |
| `text` | Primary text. |
| `textSecondary` | Secondary labels. |
| `textMuted` | Muted helper text. |
| `textDisabled` | Disabled text. |
| `accent` | Main accent. |
| `accentHover` | Accent hover. |
| `accentActive` | Accent pressed. |
| `accentSubtle` | Tinted accent background. |
| `accentContrast` | Text/icon color on the accent. |
| `success` / `successSubtle` | Success text and its tint. |
| `warning` / `warningSubtle` | Warning text and its tint. |
| `danger` / `dangerSubtle` | Error text and its tint. |
| `info` / `infoSubtle` | Informational text and its tint. |
| `lyricPlaying` | Playing lyric text. |
| `lyricPlayingBg` | Playing lyric background. |
| `lyricSelectedBg` | Selected lyric background. |
| `lyricUnsynced` / `lyricUnsyncedBg` | Unsynced lyric color and tint. |
| `lyricSynced` / `lyricSyncedBg` | Synced lyric color and tint. |
| `lyricFlagged` / `lyricFlaggedBg` | Needs-review lyric color and tint. |
| `lyricLocked` / `lyricLockedBg` | Locked lyric color and tint. |
| `timestampBg` | Timestamp chip background. |
| `timestampText` | Timestamp chip text. |
| `timestampBorder` | Timestamp chip border. |

The app checks the main text pairs against WCAG AA (4.5:1) and shows a
non-blocking warning in the editor and import preview. Low contrast is your
choice, not an install error.

The Time page also keeps non-color cues for word states: the current word,
unsynced words, review flags, and locked words retain their existing borders,
marks, and labels. Do not rely on a hue alone when making a theme.

## Effects and performance

- Effects are for chrome only: toolbars, menus, dialogs, popovers, side panels,
  and the transport bar.
- Never add `backdrop-filter`, blur, large shadows, or `mix-blend-mode` to
  Preview lyrics, Time word chips, the waveform, or anything that repaints every
  frame. Those areas keep plain semi-opaque colors.
- A glass backdrop should be one static gradient or pre-blurred image, not an
  animated or per-frame layer. Keep blur modest (12–24 px) and do not stack
  blurred layers.
- Performance mode, the per-theme "Reduce effects" switch, reduced motion, and
  a missing backdrop-filter automatically use the flat scheme. A glass theme
  must still look complete in that state.
- `prefers-contrast` is honored with stronger text and border tokens.
- The theme manager labels every theme `light`, `medium`, or `heavy` so a user on
  a slower PC can choose deliberately.

Windows 11 Mica uses the native Tauri window effect. The Windows window is
already created transparent with the configured effects, so no extra config is
needed for the Mica theme. On older Windows versions, other platforms, or a
failed API call, the theme uses its normal solid tokens.

## Optional `theme.css`

CSS is the only executable-looking part of a theme, and it is treated as data.
The loader removes `@import` rules and remote `url(...)` values by default. Local
assets referenced from `theme.css` are allowed and are converted to the app's
asset protocol; keep them inside the theme folder.

```css
/* Example: a subtle top highlight on the transport bar. */
[data-ui-chrome="audiobar"] {
  border-top: 1px solid color-mix(in srgb, var(--ttml-accent) 35%, transparent);
}

/* Example: stronger focus ring. */
button:focus-visible {
  outline: 2px solid var(--ttml-accent);
  outline-offset: 2px;
}
```

User CSS is automatically scoped to the New UI. Built-in themes ship their CSS
with the app, so they can target the same selectors without the scope wrapper.

There is no JavaScript, no HTML injection, and no theme-run scripts. Theme CSS
loads only local assets unless **Allow remote images and fonts** is turned on.
The app never fetches a theme on its own; the optional community browser is
described below.

## Installing and sharing

Open **Settings → Appearance → Themes → Manage themes**.

- **Import file** accepts a `.json`, a `.css` file (it becomes a CSS-only theme
  based on Default), or a `.zip` whose `theme.json` is at the root or inside one
  top-level folder.
- **Import folder** reads a local theme folder on desktop.
- A preview shows the name, author, version, scheme count, CSS size, assets, and
  contrast warnings before **Install & apply**.
- Invalid fields are listed without installing anything.
- **Export** downloads a single JSON with the manifest, schemes, and CSS.
- **Copy theme as text** and **Import from text** make it easy to paste a theme
  in Discord or another chat.
- **Duplicate** creates an editable copy. **Delete** is available for installed
  themes, not built-ins.
- **Reload** rereads the `themes` folder. **Auto-reload theme files** does it
  automatically while the app is open.
- **Allow remote images and fonts** is off by default. Turning it on permits
  remote `url(...)` and remote font requests in theme CSS; those requests can
  reveal your IP address to the host serving them. Local theme assets are always
  allowed.

A text export is the same JSON that the file importer accepts. A theme pack with
a separate `theme.css` is preferred for large CSS and local artwork.

## Community marketplace

Community themes are listed at
<https://rimuruslimetempest.github.io/AMLL-TTML-TOOL/>. The page is built from
`docs/registry/themes.json`, and each entry includes a preview, a SHA-256, a
performance level, and the minimum app version. The same repository holds the
JSON schema and the validator used on pull requests.

In **Settings → Appearance → Themes → Manage themes**, **Open marketplace**
opens that page in your browser. **Show community themes inside the app** is off
by default. Turning it on loads the registry and preview images from
`raw.githubusercontent.com`; the first use shows a notice, and the Privacy
Policy explains what is requested. A theme is downloaded only when you click
**Preview & install**. The file is rejected if its size or SHA-256 does not
match the registry, if it contains remote CSS loads, or if the normal theme
validation fails. Installation still goes through the same preview and
confirmation as a local import.

**Verified** means the entry was reviewed when it was added. It is not a
guarantee that a theme will suit your setup. Every other card is labelled
“Community theme, not reviewed by the app.” Themes are never installed or
updated automatically.

To submit a theme, read [CONTRIBUTING.md](./CONTRIBUTING.md) and
`docs/submit.html`. Nothing is published without a merged pull request.

## Editor and Custom CSS

The theme editor edits the active scheme's tokens with color pickers, shows a
live mini preview, includes a Custom CSS field, and offers **Save as theme**,
**Export theme**, and **Reset to default**. Saving creates a user theme; it does
not modify a built-in theme.

**Settings → Appearance → Custom theme CSS** is a separate box for small
personal tweaks. It sits on top of any theme, has an on/off switch, a Reset
button, and the same remote-content switch. It is CSS only and is sanitized and
scoped like imported CSS.

## Fallback and reset

If a stored theme is missing or invalid, the runtime uses Default and shows a
short warning. The stored id is left alone for diagnostics rather than silently
rewritten.

Ways to get back to Default:

- Press **Ctrl+Shift+Alt+T** anywhere in the app.
- Open `?resetTheme=1` in the app URL.
- Use **Settings → Appearance → Reset theme**.
- Use the **Reset theme** link in the Safe/Classic fallback banner.

Reset returns the theme, scheme, effects preference, and accent override to
their defaults, and turns off Custom CSS. Your saved CSS text is not destroyed.

## Built-in themes

- Default (Indigo)
- Liquid Glass
- Glass Dark
- Glass Light
- AMOLED Black
- Midnight Neon
- Sakura
- Mocha
- Latte
- Nord-style
- Dracula-style
- Solarized-style
- Terminal
- Paper
- High Contrast
- Windows 11 Mica

All built-ins are ordinary theme packs in the same format as user themes. They
use the token names above and can be duplicated and used as a starting point.

## Small example theme

Save this as `themes/aurora-example/theme.json` and restart or press Reload.

```json
{
  "format": 1,
  "id": "aurora-example",
  "name": "Aurora Example",
  "author": "Rimurulover",
  "version": "1.0.0",
  "description": "A small dark theme that shows every required token.",
  "effects": { "level": "none", "performance": "light" },
  "schemes": [
    {
      "id": "dark",
      "name": "Aurora Dark",
      "appearance": "dark",
      "tokens": {
        "bgBase": "#080d18",
        "bgRaised": "#0d1422",
        "bgOverlay": "#111a2c",
        "surface": "#0f1728",
        "surface2": "#162139",
        "surface3": "#1c2a46",
        "surfaceHover": "#223354",
        "border": "rgba(180, 210, 255, 0.14)",
        "borderStrong": "rgba(180, 210, 255, 0.28)",
        "text": "#eef5ff",
        "textSecondary": "#b8c8e2",
        "textMuted": "#8fa2c2",
        "textDisabled": "#647492",
        "accent": "#66d9c8",
        "accentHover": "#8be8da",
        "accentActive": "#3fbfae",
        "accentSubtle": "rgba(102, 217, 200, 0.14)",
        "accentContrast": "#041514",
        "success": "#6fe09a",
        "successSubtle": "rgba(111, 224, 154, 0.12)",
        "warning": "#f0c56a",
        "warningSubtle": "rgba(240, 197, 106, 0.12)",
        "danger": "#f08a95",
        "dangerSubtle": "rgba(240, 138, 149, 0.12)",
        "info": "#7cc4ff",
        "infoSubtle": "rgba(124, 196, 255, 0.12)",
        "lyricPlaying": "#aef7ee",
        "lyricPlayingBg": "rgba(102, 217, 200, 0.13)",
        "lyricSelectedBg": "rgba(102, 217, 200, 0.18)",
        "lyricUnsynced": "#f0c56a",
        "lyricUnsyncedBg": "rgba(240, 197, 106, 0.1)",
        "lyricSynced": "#6fe09a",
        "lyricSyncedBg": "rgba(111, 224, 154, 0.09)",
        "lyricFlagged": "#f08a95",
        "lyricFlaggedBg": "rgba(240, 138, 149, 0.1)",
        "lyricLocked": "#c9a7ff",
        "lyricLockedBg": "rgba(201, 167, 255, 0.1)",
        "timestampBg": "rgba(102, 217, 200, 0.1)",
        "timestampText": "#eef5ff",
        "timestampBorder": "rgba(102, 217, 200, 0.32)"
      }
    }
  ]
}
```

Add `theme.css` next to it for extra polish. Keep it small, and check the theme
with Performance mode on before sharing it.
