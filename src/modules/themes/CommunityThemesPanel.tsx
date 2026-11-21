import {
	ArrowDownload24Regular,
	ArrowSync24Regular,
	Globe24Regular,
	Warning24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Switch,
	Text,
} from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { toast } from "react-toastify";
import { MARKETPLACE_URL } from "$/config/links";
import { privacyPolicyDialogAtom } from "$/modules/privacy/states";
import { openExternal } from "$/utils/openExternal";
import {
	type CommunityThemeEntry,
	communityThemePreviewUrl,
	fetchCommunityTheme,
	fetchCommunityThemes,
	hasSeenCommunityThemesNotice,
	isCommunityThemesOptedIn,
	markCommunityThemesNoticeSeen,
	setCommunityThemesOptedIn,
} from "./marketplace";
import type { ThemePack } from "./types";

export function CommunityThemesPanel({
	onPreview,
}: {
	onPreview: (theme: ThemePack, css?: string) => void;
}) {
	const [optedIn, setOptedIn] = useState(isCommunityThemesOptedIn);
	const [needsNotice, setNeedsNotice] = useState(
		() => isCommunityThemesOptedIn() && !hasSeenCommunityThemesNotice(),
	);
	const [entries, setEntries] = useState<CommunityThemeEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);
	const [installingId, setInstallingId] = useState<string | null>(null);
	const setPrivacyOpen = useSetAtom(privacyPolicyDialogAtom);
	const controller = useRef<AbortController | null>(null);

	const load = useCallback(async () => {
		controller.current?.abort();
		const next = new AbortController();
		controller.current = next;
		setLoading(true);
		setFailed(false);
		try {
			const themes = await fetchCommunityThemes(next.signal);
			setEntries(themes);
		} catch (error) {
			if ((error as Error).name === "AbortError") return;
			setFailed(true);
		} finally {
			if (controller.current === next) {
				setLoading(false);
				controller.current = null;
			}
		}
	}, []);

	useEffect(() => {
		if (optedIn && !needsNotice) void load();
		return () => controller.current?.abort();
	}, [optedIn, needsNotice, load]);

	const toggle = (value: boolean) => {
		setOptedIn(value);
		setCommunityThemesOptedIn(value);
		if (!value) {
			controller.current?.abort();
			setEntries([]);
			setFailed(false);
			return;
		}
		if (!hasSeenCommunityThemesNotice()) setNeedsNotice(true);
	};

	const acknowledge = () => {
		markCommunityThemesNoticeSeen();
		setNeedsNotice(false);
	};

	const install = async (entry: CommunityThemeEntry) => {
		setInstallingId(entry.id);
		try {
			const fetched = await fetchCommunityTheme(entry);
			onPreview(fetched.theme, fetched.css);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "The community theme could not be downloaded.",
			);
		} finally {
			setInstallingId(null);
		}
	};

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex align="center" justify="between" gap="2" wrap="wrap">
					<Box>
						<Text weight="bold" size="2">
							Community themes
						</Text>
						<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
							Browse the public marketplace in your browser, or load the same
							list here. Every download is checked against its published
							SHA-256 before the normal preview.
						</Text>
					</Box>
					<Button
						variant="soft"
						onClick={() => void openExternal(MARKETPLACE_URL)}
					>
						<Globe24Regular /> Open marketplace
					</Button>
				</Flex>

				<Flex align="center" gap="2" wrap="wrap">
					<Switch checked={optedIn} onCheckedChange={toggle} />
					<Text size="2">Show community themes inside the app</Text>
					<Badge size="1" color="gray">
						Off by default
					</Badge>
				</Flex>
				<Text size="1" color="gray">
					Plugins: coming soon. This marketplace lists themes only.
				</Text>

				{needsNotice ? (
					<Card variant="surface">
						<Flex direction="column" gap="2">
							<Text size="2" weight="medium">
								<Warning24Regular /> This contacts GitHub
							</Text>
							<Text size="1" color="gray">
								Turning this on makes the app request the public theme registry
								and any preview image you view from
								raw.githubusercontent.com. Nothing about you, your project, or
								your lyrics is sent — only the request itself. Themes are
								downloaded only when you click Install. See the Privacy Policy
								for details.
							</Text>
							<Flex gap="2">
								<Button size="1" onClick={acknowledge}>
									I understand
								</Button>
								<Button
									size="1"
									variant="ghost"
									onClick={() => setPrivacyOpen(true)}
								>
									Privacy Policy
								</Button>
								<Button size="1" variant="soft" onClick={() => toggle(false)}>
									Turn off
								</Button>
							</Flex>
						</Flex>
					</Card>
				) : null}

				{optedIn && !needsNotice ? (
					loading ? (
						<Text size="1" color="gray">
							Loading community themes…
						</Text>
					) : failed ? (
						<Flex gap="2" align="center" wrap="wrap">
							<Text size="1" color="gray">
								Community themes are unavailable right now.
							</Text>
							<Button size="1" variant="soft" onClick={() => void load()}>
								<ArrowSync24Regular /> Try again
							</Button>
						</Flex>
					) : entries.length === 0 ? (
						<Text size="1" color="gray">
							No community themes are listed yet.
						</Text>
					) : (
						<Grid columns={{ initial: "1", sm: "2" }} gap="2">
							{entries.map((entry) => (
								<Card key={entry.id} variant="surface">
									<Flex direction="column" gap="2">
										<img
											src={communityThemePreviewUrl(entry)}
											alt={`${entry.name} theme preview`}
											loading="lazy"
											style={{
												width: "100%",
												aspectRatio: "16 / 9",
												objectFit: "cover",
												borderRadius: 8,
												border: "1px solid var(--gray-5)",
											}}
										/>
										<Flex align="center" gap="2" wrap="wrap">
											<Text weight="bold" size="2">
												{entry.name}
											</Text>
											<Badge size="1" color="gray">
												{entry.performance}
											</Badge>
											{entry.verified ? (
												<Badge size="1" color="indigo">
													Verified
												</Badge>
											) : null}
										</Flex>
										<Text size="1" color="gray">
											by {entry.author} · v{entry.version}
										</Text>
										<Text size="1" color="gray">
											{entry.description}
										</Text>
										{!entry.verified ? (
											<Text size="1" color="amber">
												Community theme, not reviewed by the app.
											</Text>
										) : null}
										<Button
											size="1"
											variant="soft"
											disabled={installingId !== null}
											onClick={() => void install(entry)}
										>
											<ArrowDownload24Regular />
											{installingId === entry.id
												? "Downloading…"
												: "Preview & install"}
										</Button>
									</Flex>
								</Card>
							))}
						</Grid>
					)
				) : null}
			</Flex>
		</Card>
	);
}
