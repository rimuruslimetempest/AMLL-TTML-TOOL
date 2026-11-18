# Privacy Policy

**Version:** 2026-11-06  
**Effective:** November 6, 2026

This policy describes the data flows that exist in this build of TTML Tool. It is based on the app's code and configuration. Items marked `[TODO: ...]` are unknown and still need legal or operational confirmation.

The data controller is **Rimurulover**, the author and maintainer of TTML Tool. Privacy contact: **rimurusamllttmltool@gmail.com**.

## Summary

- The editor is local-first. Projects, timing, settings, autosaves, and cached audio stay on your device unless you choose a network feature.
- Live rooms send the shared TTML project, edits, names, chat, comments, review marks, history, and any shared media to the host and everyone in the room.
- Cloud accounts use Firebase for authentication, profile data, lyric documents, and audio storage.
- AI review sends lyrics to the provider or local model you configure, only when you run a review.
- Crash reports are off by default. A content-free local copy is written after a crash so you can inspect it; nothing is sent unless you opt in and a destination is configured.
- There is no advertising, third-party analytics, or data-sale code in this build.

## 1. Local data

The app stores the following in your browser profile or desktop webview storage:

- Project lyrics, timing, metadata, sections, marks, save-file names, audio names and paths, and autosave versions. Autosaves and cached audio use the IndexedDB database `amll-autosave-db`.
- Project notes kept outside TTML: comments, review marks, restore points, room history relevant to the project, and translation/romanization language codes. These use browser `localStorage` under a project-specific key and are never written into exported TTML.
- Editor settings, UI preferences, keybindings, project-timer and completion records, ignored words, AI endpoint/model/API keys, Genius and JOOX credentials, and other feature settings. Most use `localStorage`.
- Custom background images and gradients in the IndexedDB database `amll-custom-background`.
- A local cache of your cloud profile and cloud lyric list, plus Firebase's local authentication and offline cache. Some of this can remain after sign-out until local data is cleared.
- At most one local crash report containing an error message, stack trace, component stack, app version, platform, and time.

Local data stays until you delete the project, clear the relevant cache, or use **Settings → Privacy → Clear local data**. That action removes projects, project notes, cached audio, settings, API keys, custom backgrounds, local cloud caches, the saved crash report, and consent state from this installation. It does not delete cloud files.

## 2. Live collaboration rooms

Hosting starts a temporary local server. Joining connects your browser or app to the host's server. Rooms do not require a cloud account.

- The host and room members receive your display name, assigned color, peer identifier, role, online status, edits, chat messages, comments, review marks, restore points, and any media you share.
- The room shares the current TTML project: lyrics, timing, metadata, sections, marks, and changes made during the room. Song audio and recordings can be shared when a member chooses.
- The host can create invite links with a role, expiry, maximum uses, an optional password, and optional approval-before-joining. Invite codes are random. The host can revoke an invite, kick or ban a person, lock the room, change roles, and hand over the host role.
- Roles are Host, Editor, Commenter, and Viewer. Edits to lyrics or timing are limited to Host and Editor. Comments and review marks are limited to Host, Editor, and Commenter. Viewers can follow people and listen.
- Chat is held in memory, with at most 250 messages of up to 2,000 characters. Up to 2,000 comments and 500 history entries are kept for the life of the room, together with at most 20 restore points.
- Shared media is stored in the host's operating-system temporary directory while the room runs and is removed when the room server stops. A guest may download shared media, creating a copy on the guest's device.
- Shared song audio is loaded into a guest's memory for playback. It is not written to the guest's disk unless downloaded.

**Visibility warning:** anyone with a valid invite link can join while the room is open, unless the room is locked or the invite requires approval. A password reduces, but does not eliminate, the risk of an unintended joiner. Everything placed in a room is visible to every participant and can be copied by them.

Network peers and the host can see IP addresses and connection metadata. If the host enables the Cloudflare Quick Tunnel option, Cloudflare proxies the room, sees connection metadata, and processes room traffic in transit. A local-network room may use unencrypted HTTP/WebSocket. Rooms are not end-to-end encrypted.

Room state, chat, comments, review marks, history, and restore points exist for the life of the room server. The local project notes copy on each participant's device persists with that device's project until deleted. Temporary shared-media files are cleaned up when the room server stops.

## 3. Cloud accounts and cloud library

Cloud features are optional. Signing in sends data to the Firebase project configured for the build through the `VITE_FIREBASE_*` variables. This repository does not ship a default Firebase project; if none is configured, cloud sign-in stays disabled. The operator of the project you configure receives the data.

- Authentication can use Google, GitHub, Apple, or email/password. Firebase Auth processes email address, display name, profile photo URL, provider identifier, user ID, and authentication metadata.
- A profile document is stored at `users/{uid}`. Desktop sign-in also uses a short-lived handoff record at `auth_sessions/{sessionId}` to pass a token from the browser flow to the desktop app.
- Cloud lyric documents are stored under `users/{uid}/ttmls` and include TTML content, song metadata, timing statistics, line and word counts, cover-art URLs, audio metadata, and timestamps. Project notes (comments, review marks, history) are not written into TTML and are not uploaded as part of the TTML document.
- Optional audio is stored in Firebase Storage under `users/{uid}/audio/`. Avatars are stored under `avatars/{uid}/` when Firebase Storage works.
- Published or finished documents are stored in public community collections and are readable by anyone.

**Current access rule:** the Firebase rules in this project allow public reads of `users/{uid}` and its nested `ttmls` documents. A cloud lyric save should be treated as potentially public to anyone who knows its Firestore document path, not as a private vault. Do not put sensitive information in cloud saves, metadata, covers, or audio.

The desktop sign-in handoff record contains authentication data. The current rules permit read/write access to `auth_sessions/{sessionId}` for anyone who knows the random session ID, and retention/cleanup behavior is a security TODO. Treat sign-in links as sensitive. **[TODO: tighten auth_sessions rules, add automatic expiry/deletion, and review the public-read rules]**

**Avatar fallback:** if Firebase Storage upload fails or is unavailable, the app may upload your chosen avatar to Litterbox (`litterbox.catbox.moe`, configured for 72 hours) and then to Imgur's anonymous image API. Those uploads produce public URLs and are subject to those services' policies and retention. The app does not warn before trying the fallback.

Firebase/Google acts as the authentication, database, storage, and hosting provider and receives account data, request metadata, IP address, and the content you choose to store. **[TODO: name the Firebase project owner, backup retention, data regions, and international-transfer safeguards]**

## 4. AI review and AI chat

AI Check and the AI side panel are optional. They are not used automatically and do not change timing. When you run an AI review, the app sends the relevant lyric text, TTML-like context, your prompt, and conversation history to the endpoint you configured. Translation and romanization editors do not call AI; they only record what people type or import.

- An OpenAI-compatible provider receives the request at the base URL and model you entered, with your API key.
- Ollama receives the request at the local or remote URL you entered.
- The API key, endpoint, and model are stored locally and are not sent to the app's own servers.

The AI provider may log or retain the request under its own policy. Do not send content you are not allowed to send to that provider. Local rule-based checks do not make a network request.

## 5. Search, import, and media providers

When you use a search or import feature, the app sends the query, URL, or identifiers needed for that request to the relevant service. Recipients can include:

- Genius (search, song pages, lyrics) and the wsrv.nl image proxy for Genius artwork.
- JOOX/apicx.asia, iTunes Search, QQ Music, Kuwo, Spotify, LRCLIB, lyrics.ovh, Urban Dictionary, Apple Music/TTML endpoints, and YouTube or other URLs you open in the downloader.
- CORS proxies such as api.allorigins.win and corsproxy.io, which receive the target URL and request metadata when the app cannot call a provider directly.
- GitHub for repository, release, update, and avatar resources.

These providers receive your IP address and request metadata and may use cookies or logs under their own policies. API keys and access tokens you enter are stored locally and sent to the matching provider when you use that feature. You can avoid these requests by not using the corresponding feature.

Audio download uses a local yt-dlp/ffmpeg process and contacts the URL you provide. Imported audio, lyric files, and cover images are saved locally as project data unless you upload them to a cloud account or share them in a room.

## 6. Discord Rich Presence

Discord Rich Presence is optional and must be enabled in settings. When enabled, the app sends activity details to your local Discord client over Discord's IPC connection. Depending on the current activity, this can include editing mode, track title/artist or file name, playback state, elapsed time, and activity images. Discord and people who can see your profile may receive that activity. Lyrics are not sent through Rich Presence.

## 7. Updates and external links

The desktop updater contacts GitHub to check for and download releases. That request can reveal your IP address, app version, platform, and update-check timing. Help, GitHub, wiki, Discord, and other links open in your browser or external app and are governed by those services.

## 8. Diagnostics and crash reports

Crash reports are **off by default**. The app writes at most one content-free local crash report after an unhandled error so you can inspect exactly what exists. The report contains the error message, stack trace, React component stack, app version, platform, and time. It does not contain lyrics, TTML, project metadata, audio, file paths chosen by the user, account details, display names, IP addresses, room data, or chat.

A one-time plain-language prompt may ask whether to send the report. Nothing is sent unless you opt in in that prompt or under **Settings → Privacy → Crash reports**, and the build has a destination configured. The destination is configurable at build time (`VITE_CRASH_REPORT_URL`); with no destination, the report stays on this device until you delete it. Reports may also be sent to Sentry when the build has a Sentry DSN and you opt in.

- When Sentry is active, it receives the crash data described above and processes it under its own policy. The app is configured not to attach user identity, request URLs, breadcrumbs, or lyric/audio fields. It does not use session replay, screenshots, or automatic transcription.
- The local report is stored in browser `localStorage` and is removed by **Clear local data**, the Delete button in the prompt, or the Delete button in Settings.
- You can view and copy the entire payload before deciding. Turning the setting off closes the Sentry client and stops new sends.

Sentry retention and organization details: **[TODO: name the Sentry organization and retention period]**. If no Sentry DSN or crash destination is configured, nothing leaves the device.

## 9. Cookies, advertising, and analytics

The app does not use advertising cookies, third-party analytics, cross-site tracking, or data-sale SDKs. It uses browser storage (localStorage, IndexedDB, and Cache Storage) and Firebase's local authentication cache. External pages and providers may set their own cookies under their policies.

## 10. Retention and deletion

- **Local data:** kept until you delete the project, clear the cache, or use Clear local data. This works without an account.
- **Project notes:** comments, review marks, restore points, and related history are kept with the local project until the project or local data is deleted. In a room, the host's server keeps its own capped copy for the life of the room.
- **Live rooms:** room state, chat, comments, review marks, history, and restore points last until the host stops the room or closes the app. Temporary shared media is removed when the room server stops. Participants may keep their own downloads and local project notes.
- **Cloud library:** kept in Firebase until you delete the document/audio or request account deletion. Deleted data may remain in provider backups for a limited period. **[TODO: backup retention period]**
- **Account deletion:** this build has no self-service account-deletion button. Use the instructions in Settings → Privacy or email **rimurusamllttmltool@gmail.com**. Cloud documents can be deleted individually in the cloud library.
- **Avatar fallbacks:** Litterbox is configured for 72 hours; Imgur and other providers retain data under their own policies. **[TODO: Imgur deletion process and provider retention]**
- **Crash reports:** the local report is kept until you delete it or clear local data. Remote reports, when you opt in and a destination exists, are retained by that destination. **[TODO: remote crash-report retention period]**

## 11. Security

The app uses HTTPS/WSS where the provider supports it, including Firebase, AI endpoints, search providers, and Cloudflare-tunneled rooms. A local-network room may use unencrypted HTTP/WebSocket. Live rooms are not end-to-end encrypted; the host and tunnel provider can access room traffic in transit.

No system is perfectly secure. Protect invite links and passwords, account credentials, API keys, exported TTML files, and audio. Treat shared rooms and cloud saves as shareable content. See the access-rule notice in section 3.

## 12. Children

The app is not directed to children under 13. In the EEA or UK, you must be at least 16 to use an account or live room without appropriate consent. **[TODO: confirm the minimum age with counsel]**

## 13. Your choices and rights

Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or port your personal data, and to complain to a data-protection authority. You can exercise many of these directly:

- View or withdraw consent in Settings → Privacy.
- Delete individual cloud songs and audio in the cloud library.
- Clear local projects, project notes, settings, caches, API keys, and the saved crash report locally.
- Turn crash-report sending on or off, view and copy the payload, and delete the local copy in Settings → Privacy.
- Request account or provider-side deletion by emailing **rimurusamllttmltool@gmail.com**.

Withdrawing consent stops new live-room and cloud connections in this installation and turns off diagnostics. It does not automatically delete data already stored in Firebase, on another participant's device, or in provider backups.

## 14. International transfers

Firebase/Google, Sentry, Cloudflare, AI providers, and other services may process data in countries other than yours. **[TODO: identify the controller's transfer mechanism and list relevant subprocessors and regions]**

## 15. Changes and contact

This policy may be updated when data flows change. The version and effective date are shown at the top, and material changes require a new consent decision before the affected feature is used again.

Questions or requests: **rimurusamllttmltool@gmail.com**. Controller: **Rimurulover** (GitHub: [rimuruslimetempest](https://github.com/rimuruslimetempest)).
