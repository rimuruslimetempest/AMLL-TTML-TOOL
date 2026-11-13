import {
	Box,
	Button,
	Callout,
	Dialog,
	Flex,
	ScrollArea,
	Select,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { can } from "$/modules/collab/permissions";
import {
	collabActiveAtom,
	collabRoleAtom,
} from "$/modules/collab/states";
import {
	romanizationLanguageAtom,
	translationLanguageAtom,
} from "$/modules/translation/states";
import { lyricLinesAtom } from "$/states/main";
import {
	buildSongInfoText,
	commitSongInfo,
	readSongInfo,
	songwritersFromText,
} from "./logic";
import { songInfoDialogAtom } from "./states";
import {
	SONG_INFO_STATUSES,
	SONG_INFO_STATUS_LABEL,
	type SongInfoStatus,
} from "./types";

interface Draft {
	title: string;
	artist: string;
	songwriters: string;
	lyricLanguage: string;
	links: string;
	spotifyIds: string;
	versionNotes: string;
	versionTimed: string;
	notes: string;
	status: SongInfoStatus;
}

export function SongInfoDialog() {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(songInfoDialogAtom);
	const [lyric, setLyric] = useImmerAtom(lyricLinesAtom);
	const translationLanguage = useAtomValue(translationLanguageAtom);
	const romanizationLanguage = useAtomValue(romanizationLanguageAtom);
	const setTranslationLanguage = useSetAtom(translationLanguageAtom);
	const setRomanizationLanguage = useSetAtom(romanizationLanguageAtom);
	const active = useAtomValue(collabActiveAtom);
	const role = useAtomValue(collabRoleAtom);

	const canEdit = !active || can(role, "editSongInfo");
	const canView = !active || can(role, "viewSongInfo");

	const [draft, setDraft] = useState<Draft>({
		title: "",
		artist: "",
		songwriters: "",
		lyricLanguage: "",
		links: "",
		spotifyIds: "",
		versionNotes: "",
		versionTimed: "",
		notes: "",
		status: "not-started",
	});

	const current = useMemo(() => readSongInfo(lyric), [lyric]);

	useEffect(() => {
		if (!open) return;
		const view = readSongInfo(lyric);
		setDraft({
			title: view.title,
			artist: view.artist,
			songwriters: view.songwriters.join(", "),
			lyricLanguage: view.lyricLanguage,
			links: view.links.join("\n"),
			spotifyIds: view.spotifyIds.join(", "),
			versionNotes: view.versionNotes,
			versionTimed: view.versionTimed,
			notes: view.notes,
			status: view.status,
		});
	}, [open, lyric]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || !event.altKey) return;
			if (event.key.toLowerCase() !== "i") return;
			event.preventDefault();
			setOpen(true);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [setOpen]);

	const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
		setDraft((previous) => ({ ...previous, [key]: value }));
	};

	const save = () => {
		if (!canEdit) return;
		const edit = {
			...draft,
			songwriters: songwritersFromText(draft.songwriters),
		};
		setLyric((state) => {
			const result = commitSongInfo(state, edit);
			state.metadata = result.metadata;
			state.songInfo = result.songInfo;
		});
		setTranslationLanguage(draft.translationLanguage ?? translationLanguage);
		setRomanizationLanguage(
			draft.romanizationLanguage ?? romanizationLanguage,
		);
		toast.success(t("songInfo.saved", "Song info saved with the project."));
	};

	const copy = async () => {
		const edit = {
			...draft,
			songwriters: songwritersFromText(draft.songwriters),
		};
		const result = commitSongInfo(lyric, edit);
		const text = buildSongInfoText({
			...lyric,
			metadata: result.metadata,
			songInfo: result.songInfo,
		});
		try {
			await navigator.clipboard.writeText(text);
			toast.success(t("songInfo.copied", "Song info copied."));
		} catch {
			toast.error(t("songInfo.copyFailed", "Could not copy song info."));
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				maxWidth="720px"
				style={{ width: "min(94vw, 720px)" }}
			>
				<Dialog.Title>{t("songInfo.title", "Song info")}</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"songInfo.description",
						"Everything about this song in one place. Links and notes stay in the project and are never exported into TTML.",
					)}
				</Dialog.Description>

				{!canView ? (
					<Callout.Root color="amber">
						<Callout.Text>
							{t(
								"songInfo.viewers",
								"Viewers cannot see song info. Ask the host for commenter access.",
							)}
						</Callout.Text>
					</Callout.Root>
				) : (
					<ScrollArea style={{ maxHeight: "62vh" }}>
						<Flex direction="column" gap="3" pr="2">
							{!canEdit && (
								<Callout.Root color="gray">
									<Callout.Text>
										{t(
											"songInfo.readOnly",
											"Your role can read this panel but not change it. Editors and the host can edit song info.",
										)}
									</Callout.Text>
								</Callout.Root>
							)}

							<Flex gap="3" wrap="wrap">
								<Box style={{ flex: "1 1 240px" }}>
									<Text as="label" size="1" color="gray">
										{t("songInfo.songTitle", "Song title")}
									</Text>
									<TextField.Root
										value={draft.title}
										disabled={!canEdit}
										placeholder={t(
											"songInfo.titlePlaceholder",
											"Title from TTML metadata",
										)}
										onChange={(event) => update("title", event.target.value)}
									/>
								</Box>
								<Box style={{ flex: "1 1 240px" }}>
									<Text as="label" size="1" color="gray">
										{t("songInfo.artist", "Artist")}
									</Text>
									<TextField.Root
										value={draft.artist}
										disabled={!canEdit}
										placeholder={t(
											"songInfo.artistPlaceholder",
											"Artist from TTML metadata",
										)}
										onChange={(event) => update("artist", event.target.value)}
									/>
								</Box>
							</Flex>

							<Box>
								<Text as="label" size="1" color="gray">
									{t("songInfo.songwriters", "Songwriters")}
								</Text>
								<TextField.Root
									value={draft.songwriters}
									disabled={!canEdit}
									placeholder={t(
										"songInfo.songwritersPlaceholder",
										"Separate names with commas",
									)}
									onChange={(event) =>
										update("songwriters", event.target.value)
									}
								/>
								<Text size="1" color="gray">
									{t(
										"songInfo.songwritersHelp",
										"This is the same songwriter metadata used by the Metadata editor.",
									)}
								</Text>
							</Box>

							<Box>
								<Text as="label" size="1" color="gray">
									{t("songInfo.links", "Song links")}
								</Text>
								<TextArea
									value={draft.links}
									disabled={!canEdit}
									rows={2}
									placeholder="https://…"
									onChange={(event) => update("links", event.target.value)}
								/>
								<Text size="1" color="gray">
									{t(
										"songInfo.linksHelp",
										"One link per line. Spotify track links are read as Spotify IDs.",
									)}
								</Text>
							</Box>

							<Box>
								<Text as="label" size="1" color="gray">
									{t("songInfo.spotifyIds", "Spotify IDs")}
								</Text>
								<TextField.Root
									value={draft.spotifyIds}
									disabled={!canEdit}
									placeholder={t(
										"songInfo.spotifyIdsPlaceholder",
										"Paste IDs or open.spotify.com links",
									)}
									onChange={(event) =>
										update("spotifyIds", event.target.value)
									}
								/>
							</Box>

							<Flex gap="3" wrap="wrap">
								<Box style={{ flex: "1 1 190px" }}>
									<Text as="label" size="1" color="gray">
										{t("songInfo.lyricLanguage", "Lyrics language")}
									</Text>
									<TextField.Root
										value={draft.lyricLanguage}
										disabled={!canEdit}
										placeholder="ja"
										onChange={(event) =>
											update("lyricLanguage", event.target.value)
										}
									/>
								</Box>
								<Box style={{ flex: "1 1 190px" }}>
									<Text as="label" size="1" color="gray">
										{t(
											"songInfo.translationLanguage",
											"Translation language",
										)}
									</Text>
									<TextField.Root
										value={translationLanguage}
										disabled={!canEdit}
										placeholder="en"
										onChange={(event) =>
											setTranslationLanguage(event.target.value)
										}
									/>
								</Box>
								<Box style={{ flex: "1 1 190px" }}>
									<Text as="label" size="1" color="gray">
										{t(
											"songInfo.romanizationLanguage",
											"Romanization language",
										)}
									</Text>
									<TextField.Root
										value={romanizationLanguage}
										disabled={!canEdit}
										placeholder="ja-Latn"
										onChange={(event) =>
											setRomanizationLanguage(event.target.value)
										}
									/>
								</Box>
							</Flex>

							<Flex gap="3" wrap="wrap">
								<Box style={{ flex: "1 1 220px" }}>
									<Text as="label" size="1" color="gray">
										{t("songInfo.versionTimed", "Exact version timed")}
									</Text>
									<TextField.Root
										value={draft.versionTimed}
										disabled={!canEdit}
										placeholder={t(
											"songInfo.versionTimedPlaceholder",
											"Album version, music video, live…",
										)}
										onChange={(event) =>
											update("versionTimed", event.target.value)
										}
									/>
								</Box>
								<Box style={{ flex: "1 1 220px" }}>
									<Text as="label" size="1" color="gray">
										{t("songInfo.status", "Status")}
									</Text>
									<Select.Root
										value={draft.status}
										disabled={!canEdit}
										onValueChange={(value) =>
											update("status", value as SongInfoStatus)
										}
									>
										<Select.Trigger style={{ width: "100%" }} />
										<Select.Content>
											{SONG_INFO_STATUSES.map((status) => (
												<Select.Item key={status} value={status}>
													{SONG_INFO_STATUS_LABEL[status]}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
								</Box>
							</Flex>

							<Box>
								<Text as="label" size="1" color="gray">
									{t("songInfo.versionNotes", "Version notes")}
								</Text>
								<TextArea
									value={draft.versionNotes}
									disabled={!canEdit}
									rows={2}
									placeholder={t(
										"songInfo.versionNotesPlaceholder",
										"Clean, explicit, different offset…",
									)}
									onChange={(event) =>
										update("versionNotes", event.target.value)
									}
								/>
							</Box>

							<Box>
								<Text as="label" size="1" color="gray">
									{t("songInfo.notes", "Notes")}
								</Text>
								<TextArea
									value={draft.notes}
									disabled={!canEdit}
									rows={3}
									placeholder={t(
										"songInfo.notesPlaceholder",
										"Anything useful for this submission",
									)}
									onChange={(event) => update("notes", event.target.value)}
								/>
							</Box>

							<Text size="1" color="gray">
								{t("songInfo.currentStatus", {
									status: SONG_INFO_STATUS_LABEL[current.status],
									defaultValue: `Saved status: ${SONG_INFO_STATUS_LABEL[current.status]}`,
								})}
							</Text>
						</Flex>
					</ScrollArea>
				)}

				<Flex justify="end" gap="2" mt="4">
					<Button variant="soft" color="gray" onClick={copy}>
						{t("songInfo.copy", "Copy song info")}
					</Button>
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.close", "Close")}
						</Button>
					</Dialog.Close>
					{canView && (
						<Button onClick={save} disabled={!canEdit}>
							{t("common.save", "Save")}
						</Button>
					)}
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
