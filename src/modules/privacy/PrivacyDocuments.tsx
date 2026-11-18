import { Box, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { REPORT_EMAIL } from "$/config/links";
import {
	PRIVACY_POLICY_UPDATED,
	PRIVACY_POLICY_VERSION,
	TERMS_VERSION,
} from "./constants";

const Section = ({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) => (
	<Box mt="4">
		<Heading size="3" mb="1">
			{title}
		</Heading>
		<Box>{children}</Box>
	</Box>
);

const P = ({ children }: { children: ReactNode }) => (
	<Text as="p" size="2" style={{ margin: "6px 0", lineHeight: 1.6 }}>
		{children}
	</Text>
);

const List = ({ children }: { children: ReactNode }) => (
	<ul style={{ margin: "6px 0", paddingLeft: 22, lineHeight: 1.6 }}>
		{children}
	</ul>
);

const Item = ({ children }: { children: ReactNode }) => (
	<li>
		<Text size="2">{children}</Text>
	</li>
);

const Todo = ({ children }: { children: ReactNode }) => (
	<strong>[TODO: {children}]</strong>
);

export function PrivacyPolicyContent() {
	return (
		<Box>
			<Text as="div" size="1" color="gray">
				Version {PRIVACY_POLICY_VERSION} · Effective {PRIVACY_POLICY_UPDATED}
			</Text>
			<P>
				This policy describes the data flows that exist in this build of the
				app. It is written from the code and configuration in the project, not
				from a generic template. Where a legal or operational detail is not
				known, it is marked as a TODO.
			</P>
			<P>
				The data controller is Rimurulover, the author and maintainer of TTML
				Tool. The privacy contact is{" "}
				<a href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a>.
			</P>

			<Section title="The short version">
				<List>
					<Item>
						The editor is local-first. Lyrics, timing, settings, autosaves, and
						cached audio stay on your device unless you choose a feature that
						sends them elsewhere.
					</Item>
					<Item>
						Live rooms send the shared project, edits, chat, display name, and
						any shared media to the host's room server and the people in the
						room.
					</Item>
					<Item>
						Cloud accounts use Firebase for authentication, profile data, lyric
						documents, and audio storage.
					</Item>
					<Item>
						AI review sends lyric content only to the provider or local model
						you configure, and only when you run a review.
					</Item>
					<Item>
						Error reporting is off by default. It is sent to Sentry only if you
						opt in and the build has a Sentry DSN configured.
					</Item>
					<Item>
						Update checks contact GitHub and send only the app version and
						operating-system name. They never send lyrics, projects, or account
						data, and updates install only after you choose Update now.
					</Item>
					<Item>
						The app contains no advertising, third-party analytics, or data-sale
						SDKs in this build.
					</Item>
				</List>
			</Section>

			<Section title="1. Data kept on your device">
				<P>
					The app stores the following locally in your browser profile or the
					desktop app's webview storage:
				</P>
				<List>
					<Item>
						Project lyrics, timing, metadata, sections, marks, save-file names,
						audio file names and paths, and autosave versions. Autosaves and
						cached audio use the IndexedDB database{" "}
						<code>amll-autosave-db</code>.
					</Item>
					<Item>
						Editor settings, UI preferences, keybindings, project-timer and
						completion records, ignored words, AI endpoint/model/API keys,
						Genius and JOOX credentials, and other feature settings. Most of
						these use browser <code>localStorage</code>.
					</Item>
					<Item>
						Custom background images and gradients in the IndexedDB database{" "}
						<code>amll-custom-background</code>.
					</Item>
					<Item>
						A local cache of your cloud profile and cloud lyric list, and
						Firebase's local authentication/offline cache. This can remain after
						you sign out until you clear local data.
					</Item>
				</List>
				<P>
					Local data stays until you delete the project, clear the relevant
					cache, or use <strong>Settings → Privacy → Clear local data</strong>.
					Clearing local data removes projects, audio caches, settings, API
					keys, custom backgrounds, and consent state from this installation. It
					does not delete cloud files.
				</P>
			</Section>

			<Section title="Update checks">
				<P>
					When automatic update checks are enabled, the desktop app contacts
					GitHub Releases at most once per day. The request contains the app
					version and operating-system name; it does not contain lyrics,
					projects, account details, or device identifiers. Manual checks send
					the same information.
				</P>
				<P>
					If an update is offered, the signed release metadata and installer are
					downloaded from this project's GitHub repository. Nothing is installed
					until you choose <strong>Update now</strong>; choosing Later or Skip
					this version leaves the app unchanged. You can turn automatic checks
					off in Settings → About.
				</P>
			</Section>

			<Section title="2. Live collaboration rooms">
				<P>
					When you host a live room, the desktop app starts a temporary local
					server. When you join a room, your browser or app connects to the
					host's server. The room is not a cloud account and does not require
					signing in.
				</P>
				<List>
					<Item>
						The host and room members receive your display name, a randomly
						assigned color, your peer identifier, your edits, chat messages, and
						your connection status.
					</Item>
					<Item>
						The room shares the current TTML project: lyrics, timing, metadata,
						sections, marks, and the changes made in the room. It can also share
						song audio or recordings when a member chooses to share them.
					</Item>
					<Item>
						Song info shared with the room includes extra video or reference
						links, version notes, the exact version timed, free-form notes, and
						the status line. Title, artist, songwriters, Spotify IDs, and the
						lyric language are the project's TTML metadata. Links and notes are
						never written into exported TTML.
					</Item>
					<Item>
						The room split dictionary stores each shared suggestion's word,
						split pattern, the author's display name, and an optional note. It
						lives only in the host's room server memory and is lost when the
						room ends. Anyone with commenter access or higher can browse it,
						editors and the host can add entries, and only the host can remove
						entries.
					</Item>
					<Item>
						Chat is held in the room server's memory. The room server keeps at
						most 250 chat messages, each limited to 2,000 characters.
					</Item>
					<Item>
						Shared media is stored in the host's operating-system temporary
						directory while the room is running and removed when the room server
						stops. A guest may choose to download shared media; that creates a
						copy on the guest's device.
					</Item>
					<Item>
						Shared song audio is loaded into a guest's memory for playback. It
						is not written to the guest's disk unless the guest downloads it.
					</Item>
				</List>
				<P>
					The host can create invite links with a role, expiry, maximum uses, an
					optional password, and optional approval before joining. Invites can
					be revoked or regenerated; people can be kicked, banned, or locked
					out. Roles are Host, Editor, Commenter, and Viewer. Only the host and
					editors can edit lyrics or timing, and only the host, editors, and
					commenters can comment or review.
				</P>
				<P>
					<strong>Visibility warning:</strong> anyone with a valid invite link
					can join while the room is open unless it is locked or approval is
					required. A password reduces, but does not eliminate, that risk.
					Assume that everything placed in a room is visible to every
					participant and may be copied by them.
				</P>
				<P>
					Network peers and the host can see IP addresses and connection
					metadata. If the host enables the Cloudflare Quick Tunnel option,
					Cloudflare also proxies the room, sees connection metadata, and can
					process room traffic in transit. The local-network option may use
					unencrypted HTTP/WebSocket traffic. Rooms are not end-to-end
					encrypted.
				</P>
				<P>
					Room state exists only for the life of the room. Chat, comments,
					review marks, history, and restore points are not persisted in the
					host's room database after the host stops the room or closes the app.
					Each participant's app may keep a local project-notes copy of
					comments, review marks, and related history with that project; those
					notes are never written into TTML. Temporary shared-media files are
					cleaned up when the room server stops.
				</P>
			</Section>

			<Section title="3. Cloud accounts and the cloud library">
				<P>
					Cloud features are optional. If you create an account or sign in, the
					app sends data to the Firebase project configured for the build. This
					repository does not ship a default project. If you configure your own
					Firebase project, that project's operator receives the data instead.
				</P>
				<List>
					<Item>
						Authentication can use Google, GitHub, Apple, or email/password.
						Firebase Auth processes your email address, display name, profile
						photo URL, provider identifier, user ID, and authentication
						metadata.
					</Item>
					<Item>
						The app stores a profile document at{" "}
						<code>users/&#123;uid&#125;</code>. Desktop sign-in also uses a
						short-lived handoff record at{" "}
						<code>auth_sessions/&#123;sessionId&#125;</code> to pass a token
						from the browser flow to the desktop app.
					</Item>
					<Item>
						Cloud lyric documents are stored under{" "}
						<code>users/&#123;uid&#125;/ttmls</code> and include TTML content,
						song metadata, timing statistics, line and word counts, cover-art
						URLs, audio metadata, and timestamps.
					</Item>
					<Item>
						If you choose to attach audio, the audio file is stored in Firebase
						Storage under <code>users/&#123;uid&#125;/audio/</code>. Avatars are
						stored under <code>avatars/&#123;uid&#125;/</code> when Firebase
						Storage works.
					</Item>
					<Item>
						Published or finished lyric documents are stored in the public
						community collections and are readable by anyone.
					</Item>
				</List>
				<P>
					<strong>Current access rule:</strong> the Firebase rules in this
					project allow public reads of <code>users/&#123;uid&#125;</code> and
					its nested <code>ttmls</code> documents. In practice, a cloud lyric
					save should be treated as potentially public to anyone who knows its
					Firestore document path, not as a private vault. Do not put sensitive
					information in cloud saves, metadata, covers, or audio.
				</P>
				<P>
					The desktop sign-in handoff record contains authentication data. The
					current rules permit read/write access to{" "}
					<code>auth_sessions/&#123;sessionId&#125;</code> for anyone who knows
					the random session ID, and the retention/cleanup behavior is a
					security TODO. Treat sign-in links as sensitive.{" "}
					<Todo>
						tighten auth_sessions rules, add automatic expiry/deletion, and
						review the public-read rules
					</Todo>
				</P>
				<P>
					Avatar fallback: if Firebase Storage upload fails or is unavailable,
					the app may upload your chosen avatar to Litterbox
					(litterbox.catbox.moe, configured for 72 hours) and then to Imgur's
					anonymous image API. Those uploads produce public URLs and are subject
					to those services' policies and retention. The app does not tell you
					before trying the fallback.
				</P>
				<P>
					Firebase/Google acts as the authentication, database, storage, and
					hosting provider. Firebase receives account data, request metadata, IP
					address, and the content you choose to store.{" "}
					<Todo>
						name the Firebase project owner, backup retention, data-region, and
						international-transfer safeguards
					</Todo>
				</P>
			</Section>

			<Section title="4. AI review and AI chat">
				<P>
					AI Check and the AI side panel are optional. They are not used
					automatically, and they do not change timing. When you run an AI
					review, the app sends the relevant lyric text, TTML/TTML-like context,
					your prompt, and the conversation history to the endpoint you
					configured.
				</P>
				<List>
					<Item>
						For an OpenAI-compatible provider, the request goes to the base URL
						and model you entered, with the API key you entered.
					</Item>
					<Item>
						For Ollama, the request goes to the local or remote Ollama URL you
						entered.
					</Item>
					<Item>
						The API key, endpoint, and model are stored locally. They are not
						sent to the app's own servers.
					</Item>
				</List>
				<P>
					The AI provider may log or retain the request under its own policy. Do
					not send lyrics or other content that you are not allowed to send to
					that provider. Local rule-based checks do not make a network request.
				</P>
			</Section>

			<Section title="5. Search, import, and media providers">
				<P>
					When you use a search or import feature, the app sends the query, URL,
					or identifiers needed for that request to the relevant service.
					Typical recipients include:
				</P>
				<List>
					<Item>
						Genius (search, song pages, lyrics) and the wsrv.nl image proxy for
						Genius artwork.
					</Item>
					<Item>
						JOOX/apicx.asia, iTunes Search, QQ Music, Kuwo, Spotify, LRCLIB,
						lyrics.ovh, Urban Dictionary, Apple Music/TTML endpoints, and
						YouTube or other URLs you open in the downloader.
					</Item>
					<Item>
						CORS proxies such as api.allorigins.win and corsproxy.io, which
						receive the target URL and request metadata when the app cannot call
						a provider directly.
					</Item>
					<Item>
						GitHub for repository, release, update, and avatar resources.
					</Item>
				</List>
				<P>
					Those providers receive your IP address and request metadata and may
					use cookies or logs under their own policies. API keys and access
					tokens you enter are stored locally and are sent to the matching
					provider when you use that feature. You can avoid these requests by
					not using the corresponding import/search feature.
				</P>
				<P>
					Audio download uses a local yt-dlp/ffmpeg process and contacts the URL
					you provide. Imported audio, lyric files, and cover images are saved
					locally as project data unless you choose to upload them to a cloud
					account or share them in a room.
				</P>
			</Section>

			<Section title="6. Discord Rich Presence">
				<P>
					Discord Rich Presence is optional and must be enabled in settings.
					When enabled, the app sends activity details to your local Discord
					client over Discord's IPC connection. Depending on the current
					activity, this can include the editing mode, track title/artist or
					file name, playback state, elapsed time, and activity images. Discord
					and other people who can see your Discord profile may receive that
					activity. The app does not send your lyrics through Rich Presence.
				</P>
			</Section>

			<Section title="7. Updates and external links">
				<P>
					The desktop updater contacts GitHub to check for and download
					releases. That request can reveal your IP address, app version,
					platform, and update-check timing. Help, GitHub, wiki, Discord, and
					other links open in your browser or external app and are governed by
					those services.
				</P>
			</Section>

			<Section title="8. Diagnostics and error reporting">
				<P>
					Crash reports are <strong>off by default</strong>. After an unhandled
					error the app writes at most one content-free local report so you can
					inspect exactly what exists. It includes the error message, stack
					trace, component stack, app version, platform, and time. It does not
					include lyrics, TTML, project metadata, audio, user-chosen file paths,
					account details, names, IP addresses, room data, or chat.
				</P>
				<P>
					A one-time plain-language prompt may ask whether to send the report.
					Nothing is sent unless you opt in and the build has a destination
					configured. The destination is configurable at build time with{" "}
					<code>VITE_CRASH_REPORT_URL</code>; with no destination, the report
					stays in this installation until you delete it. A Sentry DSN, when
					configured, may also receive reports after opt-in.
				</P>
				<List>
					<Item>
						You can view and copy the entire payload before deciding, turn
						sending on or off in Settings → Privacy, and delete the local copy
						there or in the prompt.
					</Item>
					<Item>
						The app is configured not to attach your user identity, request
						URLs, breadcrumbs, or lyric/audio fields. It does not use session
						replay, screenshots, or automatic transcription.
					</Item>
					<Item>
						A configured remote destination or Sentry processes the report under
						its own policy.{" "}
						<Todo>
							name the remote crash-report organization and retention period
						</Todo>
					</Item>
				</List>
				<P>
					If you never opt in, the app does not initialize Sentry and does not
					send the local report anywhere. Turning the setting off closes the
					Sentry client and stops new sends.
				</P>
			</Section>

			<Section title="9. Cookies, advertising, and analytics">
				<P>
					The app itself does not use advertising cookies, third-party
					analytics, cross-site tracking, or data-sale SDKs. It uses browser
					storage (localStorage, IndexedDB, and Cache Storage) and Firebase's
					local authentication cache. Embedded external pages and providers may
					set their own cookies under their policies.
				</P>
			</Section>

			<Section title="10. Retention and deletion">
				<List>
					<Item>
						<strong>Local data:</strong> kept until you delete the project,
						clear the cache, or use Clear local data. You can do this without an
						account.
					</Item>
					<Item>
						<strong>Live rooms:</strong> room state and chat last until the host
						stops the room or closes the app. Temporary shared media is removed
						when the room server stops. Participants may retain their own
						downloaded copies.
					</Item>
					<Item>
						<strong>Cloud library:</strong> kept in Firebase until you delete
						the document/audio or request account deletion. Deleted data may
						remain in provider backups for a limited period.{" "}
						<Todo>backup retention period</Todo>
					</Item>
					<Item>
						<strong>Account deletion:</strong> this build has no self-service
						account-deletion button. Use the deletion instructions in Settings →
						Privacy or email <Todo>privacy email address</Todo>. Cloud documents
						can be deleted individually from the cloud library.
					</Item>
					<Item>
						<strong>Avatar fallbacks:</strong> Litterbox is configured for 72
						hours; Imgur and other providers retain data under their own
						policies. <Todo>Imgur deletion process and provider retention</Todo>
					</Item>
					<Item>
						<strong>Crash reports:</strong> the local copy is kept until you
						delete it or clear local data. Remote reports, when you opt in and a
						destination exists, are retained by that destination.{" "}
						<Todo>remote crash-report retention period</Todo>
					</Item>
				</List>
			</Section>

			<Section title="11. Security">
				<P>
					The app uses HTTPS/WSS where the provider supports it, including
					Firebase, AI endpoints, search providers, and Cloudflare-tunneled
					rooms. A local-network room may use unencrypted HTTP/WebSocket. Live
					rooms are not end-to-end encrypted; the host and tunnel provider can
					access room traffic in transit.
				</P>
				<P>
					No system is perfectly secure. Protect invite links, account
					credentials, API keys, exported TTML files, and audio. Treat shared
					rooms and cloud saves as shareable content. See the access-rule notice
					in section 3.
				</P>
			</Section>

			<Section title="12. Children">
				<P>
					The app is not directed to children under 13. If you are in the EEA or
					UK, you must be at least 16 to use an account or live room without
					appropriate consent. <Todo>confirm the minimum age with counsel</Todo>
				</P>
			</Section>

			<Section title="13. Your choices and rights">
				<P>
					Depending on where you live, you may have rights to access, correct,
					delete, restrict, object to, or port your personal data, and to
					complain to a data-protection authority. You can exercise many of
					these directly:
				</P>
				<List>
					<Item>View or withdraw consent in Settings → Privacy.</Item>
					<Item>
						Delete individual cloud songs and audio in the cloud library.
					</Item>
					<Item>
						Clear local projects, settings, caches, and API keys locally.
					</Item>
					<Item>
						Request account or provider-side deletion by emailing{" "}
						<a href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a>.
					</Item>
				</List>
				<P>
					Withdrawing consent stops new live-room and cloud connections in this
					installation. It does not automatically delete data already stored in
					Firebase, on another participant's device, or in provider backups.
				</P>
			</Section>

			<Section title="14. International transfers">
				<P>
					Firebase/Google, Sentry, Cloudflare, AI providers, and other services
					may process data in countries other than yours.{" "}
					<Todo>
						identify the controller's transfer mechanism and list the relevant
						subprocessors and regions
					</Todo>
				</P>
			</Section>

			<Section title="15. Changes and contact">
				<P>
					We may update this policy when data flows change. The version and
					effective date are shown at the top, and material changes require a
					new consent decision before the affected feature is used again.
				</P>
				<P>
					Questions or requests:{" "}
					<a href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a>. Controller: the
					operator of this app.
				</P>
			</Section>
		</Box>
	);
}

export function TermsContent() {
	return (
		<Box>
			<Text as="div" size="1" color="gray">
				Version {TERMS_VERSION} · Effective {PRIVACY_POLICY_UPDATED}
			</Text>
			<P>
				These terms are a plain-language draft for this build. They are not a
				substitute for legal review. <Todo>legal review and governing law</Todo>
			</P>

			<Section title="1. Acceptance">
				<P>
					By using the app, creating an account, hosting or joining a live room,
					or accepting the consent dialog, you agree to these terms and the
					Privacy Policy. If you do not agree, do not use the affected feature.
				</P>
			</Section>

			<Section title="2. Eligibility and accounts">
				<P>
					You must be old enough to consent to data processing in your
					jurisdiction. You are responsible for your account credentials, API
					keys, invite links, and activity. Do not share credentials or use
					another person's account without permission.
				</P>
			</Section>

			<Section title="3. Your content">
				<P>
					You keep ownership of the lyrics, timing, audio, images, and other
					content you create or import. You grant the app and its configured
					service providers the limited permission needed to store, transmit,
					display, and process that content when you use a feature. You must
					have the rights needed to upload, share, or publish the content.
				</P>
				<P>
					Cloud saves are not a private vault in this build. Published items and
					cloud library records may be readable by others as described in the
					Privacy Policy. Do not upload confidential material.
				</P>
			</Section>

			<Section title="4. Acceptable use">
				<List>
					<Item>
						Do not upload or share content you do not have permission to use.
					</Item>
					<Item>
						Do not use live rooms to harass, threaten, impersonate, spam, or
						distribute unlawful material.
					</Item>
					<Item>
						Do not attempt to access another person's account, room, cloud
						library, or credentials.
					</Item>
					<Item>
						Do not use the app to break copyright, privacy, or other applicable
						laws.
					</Item>
					<Item>
						Do not overload, probe, or interfere with hosting, Firebase,
						Cloudflare, AI, search, or update services.
					</Item>
				</List>
			</Section>

			<Section title="5. Live rooms">
				<P>
					The host controls the room and its lifetime, including roles, invite
					links, passwords, expiry, approval, removal, bans, room lock, and
					restoring earlier states. Anyone with a valid invite can join while it
					is open unless the room is locked or approval is required. The host
					and participants can see and copy what is shared, including comments,
					review notes, and room history. The app does not provide end-to-end
					encryption. The host is responsible for the room and the content
					shared in it.
				</P>
			</Section>

			<Section title="6. Cloud and third-party services">
				<P>
					Cloud features depend on Firebase. Search, import, AI, Discord,
					Cloudflare, Sentry, avatar fallback, and update features depend on
					third-party services. Their availability, terms, and privacy policies
					are their own. The app is not responsible for their acts, omissions,
					retention, or outages.
				</P>
			</Section>

			<Section title="7. AI output">
				<P>
					AI review is assistive only. It can be wrong, incomplete, or
					offensive. You are responsible for reviewing suggestions before using
					them. AI features do not automatically change timing or lyrics.
				</P>
			</Section>

			<Section title="8. Availability and changes">
				<P>
					The app and services may change, be suspended, or be discontinued.
					Features may be unavailable because of maintenance, provider limits,
					network conditions, or platform restrictions. Back up important
					projects and exports.
				</P>
			</Section>

			<Section title="9. Termination">
				<P>
					Access to cloud or live features may be limited or terminated for
					misuse, security risk, legal requirements, or provider action. You may
					stop using the app at any time and can withdraw consent in Settings →
					Privacy.
				</P>
			</Section>

			<Section title="10. Disclaimer and limitation">
				<P>
					To the maximum extent permitted by law, the app is provided “as is”
					and without warranties of merchantability, fitness for a particular
					purpose, non-infringement, or uninterrupted availability.{" "}
					<Todo>liability cap, exclusions, and consumer-law carve-outs</Todo>
				</P>
			</Section>

			<Section title="11. Governing law and disputes">
				<P>
					<Todo>
						governing law, venue, dispute-resolution process, and any mandatory
						consumer protections
					</Todo>
				</P>
			</Section>

			<Section title="12. Contact">
				<P>
					Legal and privacy contact:{" "}
					<a href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a>.
				</P>
			</Section>
		</Box>
	);
}
