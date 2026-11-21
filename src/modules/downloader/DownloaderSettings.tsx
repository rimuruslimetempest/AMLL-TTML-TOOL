import {
	ArrowDownload24Regular,
	ArrowSync24Regular,
	Checkmark24Regular,
	Copy24Regular,
	FolderOpen24Regular,
	Warning24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Card,
	Code,
	Flex,
	Separator,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { formatBytes } from "./model";
import {
	downloaderCookiesFileAtom,
	downloaderDailyUpdateCheckAtom,
} from "./states";

type ToolStatus = {
	name: string;
	path: string | null;
	version: string | null;
	source: "custom" | "appData" | "bundled" | "system" | "missing";
};

type DownloaderInfo = {
	ytDlp: ToolStatus;
	ffmpeg: ToolStatus;
	ffprobe: ToolStatus;
	jsRuntime: ToolStatus;
	platform: string;
	arch: string;
	appToolDir: string;
};

type UpdateCheck = {
	current: string;
	latest: string;
	updateAvailable: boolean;
	assetName: string;
	assetUrl: string;
	size: number;
	sha256: string | null;
	releaseUrl: string;
};

const LAST_CHECK_KEY = "downloaderLastUpdateCheck";
const DAY_MS = 24 * 60 * 60 * 1000;

const SOURCE_LABEL: Record<ToolStatus["source"], string> = {
	custom: "Your file",
	appData: "Updated in app",
	bundled: "Bundled",
	system: "System",
	missing: "Not found",
};

function statusColor(source: ToolStatus["source"]) {
	if (source === "missing") return "red" as const;
	if (source === "custom") return "violet" as const;
	if (source === "appData") return "green" as const;
	return "gray" as const;
}

function ToolRow({ status }: { status: ToolStatus }) {
	return (
		<Flex align="center" gap="2" wrap="wrap">
			<Text size="2" weight="medium" style={{ minWidth: 72 }}>
				{status.name}
			</Text>
			<Badge size="1" variant="soft" color={statusColor(status.source)}>
				{SOURCE_LABEL[status.source]}
			</Badge>
			<Text size="1" color="gray">
				{status.version ?? "not detected"}
			</Text>
			{status.path && (
				<Text
					size="1"
					color="gray"
					style={{
						maxWidth: "100%",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
					title={status.path}
				>
					{status.path}
				</Text>
			)}
		</Flex>
	);
}

async function openExternal(url: string) {
	if (isTauri()) {
		const { open: openUrl } = await import("@tauri-apps/plugin-shell");
		await openUrl(url);
	} else {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}

export function DownloaderSettings() {
	const [info, setInfo] = useState<DownloaderInfo | null>(null);
	const [check, setCheck] = useState<UpdateCheck | null>(null);
	const [busy, setBusy] = useState<"check" | "update" | "ffmpeg" | "test" | null>(
		null,
	);
	const [testOutput, setTestOutput] = useState("");
	const [failure, setFailure] = useState("");
	const [ytPath, setYtPath] = useState("");
	const [ffmpegPath, setFfmpegPath] = useState("");
	const [cookiesFile, setCookiesFile] = useAtom(downloaderCookiesFileAtom);
	const [dailyCheck, setDailyCheck] = useAtom(downloaderDailyUpdateCheckAtom);

	const load = useCallback(async () => {
		if (!isTauri()) return;
		try {
			const next = await invoke<DownloaderInfo>("downloader_info");
			setInfo(next);
			setYtPath(next.ytDlp.source === "custom" ? (next.ytDlp.path ?? "") : "");
			setFfmpegPath(
				next.ffmpeg.source === "custom" ? (next.ffmpeg.path ?? "") : "",
			);
		} catch (error) {
			setFailure(String(error));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const checkUpdates = useCallback(async (quiet = false) => {
		if (!isTauri()) return;
		setBusy("check");
		setFailure("");
		try {
			const result = await invoke<UpdateCheck>("check_ytdlp_update");
			setCheck(result);
			localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
			if (!quiet) {
				toast.success(
					result.updateAvailable
						? `yt-dlp ${result.latest} is available.`
						: "yt-dlp is up to date.",
				);
			}
		} catch (error) {
			if (!quiet) {
				setFailure(
					error instanceof Error ? error.message : String(error),
				);
			}
		} finally {
			setBusy(null);
		}
	}, []);

	useEffect(() => {
		if (!dailyCheck || !isTauri()) return;
		const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? "0");
		if (Number.isFinite(last) && Date.now() - last < DAY_MS) return;
		void checkUpdates(true);
	}, [dailyCheck, checkUpdates]);

	const updateYtDlp = useCallback(async () => {
		if (!isTauri()) return;
		setBusy("update");
		setFailure("");
		try {
			await invoke<ToolStatus>("update_ytdlp");
			toast.success("yt-dlp was updated and verified.");
			setCheck(null);
			await load();
		} catch (error) {
			setFailure(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(null);
		}
	}, [load]);

	const repairFfmpeg = useCallback(async () => {
		if (!isTauri()) return;
		setBusy("ffmpeg");
		setFailure("");
		try {
			await invoke<ToolStatus>("download_ffmpeg");
			toast.success("FFmpeg was downloaded and verified.");
			await load();
		} catch (error) {
			setFailure(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(null);
		}
	}, [load]);

	const runTest = useCallback(async () => {
		if (!isTauri()) return;
		setBusy("test");
		setFailure("");
		try {
			const result = await invoke<{ ok: boolean; output: string }>(
				"test_downloader",
			);
			setTestOutput(result.output);
			if (result.ok) toast.success("yt-dlp and FFmpeg responded.");
			else toast.warning("Some downloader tools are missing.");
		} catch (error) {
			setFailure(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(null);
		}
	}, []);

	const chooseFile = useCallback(
		async (kind: "yt-dlp" | "ffmpeg" | "cookies") => {
			try {
				const selected = await open({
					multiple: false,
					directory: false,
					title:
						kind === "cookies"
							? "Choose a cookies.txt file"
							: `Choose ${kind}`,
				});
				if (typeof selected !== "string") return;
				if (kind === "yt-dlp") setYtPath(selected);
				else if (kind === "ffmpeg") setFfmpegPath(selected);
				else setCookiesFile(selected);
			} catch {
				// The dialog was cancelled or the plugin is unavailable.
			}
		},
		[setCookiesFile],
	);

	const savePaths = useCallback(async () => {
		if (!isTauri()) return;
		setFailure("");
		try {
			await invoke<DownloaderInfo>("set_tool_paths", {
				ytDlp: ytPath,
				ffmpeg: ffmpegPath,
			});
			toast.success("Downloader paths saved.");
			await load();
		} catch (error) {
			setFailure(error instanceof Error ? error.message : String(error));
		}
	}, [ffmpegPath, load, ytPath]);

	const copyDebug = useCallback(async () => {
		const text = [
			`TTML Tool downloader diagnostics`,
			`Platform: ${info?.platform ?? "?"} ${info?.arch ?? "?"}`,
			`yt-dlp: ${info?.ytDlp.version ?? "missing"} (${info?.ytDlp.source ?? "?"})`,
			`FFmpeg: ${info?.ffmpeg.version ?? "missing"} (${info?.ffmpeg.source ?? "?"})`,
			`Deno: ${info?.jsRuntime.version ?? "missing"} (${info?.jsRuntime.source ?? "?"})`,
			`App tool folder: ${info?.appToolDir ?? "?"}`,
			testOutput ? `Test output:\n${testOutput}` : "",
			failure ? `Last error:\n${failure}` : "",
		]
			.filter(Boolean)
			.join("\n");
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Copied downloader diagnostics.");
		} catch {
			toast.error("Could not copy the diagnostics.");
		}
	}, [failure, info, testOutput]);

	if (!isTauri()) {
		return (
			<Card variant="surface">
				<Text size="2" color="gray">
					The media downloader and its yt-dlp management are available in the
					desktop app.
				</Text>
			</Card>
		);
	}

	return (
		<Card variant="surface">
			<Flex direction="column" gap="3">
				<Flex align="center" justify="between" gap="3" wrap="wrap">
					<Box>
						<Text weight="bold" size="3">
							Media downloader tools
						</Text>
						<Text size="1" color="gray" as="div">
							yt-dlp, FFmpeg, and the JavaScript runtime used for YouTube
							extraction. Updates are downloaded from the official yt-dlp
							GitHub release and checked against its SHA-256 checksum before
							they are used.
						</Text>
					</Box>
					<Flex gap="2" wrap="wrap">
						<Button
							size="1"
							variant="soft"
							onClick={() => void checkUpdates()}
							loading={busy === "check"}
							disabled={busy !== null}
						>
							<ArrowSync24Regular />
							Check for updates
						</Button>
						<Button
							size="1"
							variant="soft"
							onClick={() => void runTest()}
							loading={busy === "test"}
							disabled={busy !== null}
						>
							<Checkmark24Regular />
							Test yt-dlp
						</Button>
						<Button size="1" variant="soft" onClick={() => void copyDebug()}>
							<Copy24Regular />
							Copy debug log
						</Button>
					</Flex>
				</Flex>

				{info && (
					<Card variant="surface" style={{ padding: 12 }}>
						<Flex direction="column" gap="2">
							<ToolRow status={info.ytDlp} />
							<ToolRow status={info.ffmpeg} />
							<ToolRow status={info.ffprobe} />
							<ToolRow status={info.jsRuntime} />
						</Flex>
					</Card>
				)}

				{check && (
					<Callout.Root color={check.updateAvailable ? "amber" : "green"}>
						<Callout.Icon>
							{check.updateAvailable ? <Warning24Regular /> : <Checkmark24Regular />}
						</Callout.Icon>
						<Callout.Text>
							{check.updateAvailable
								? `yt-dlp ${check.latest} is available (you have ${check.current}). ${formatBytes(check.size)}.`
								: `yt-dlp ${check.current} is the latest release.`}
						</Callout.Text>
						{check.updateAvailable && (
							<Flex gap="2" mt="2" wrap="wrap">
								<Button
									size="1"
									onClick={() => void updateYtDlp()}
									loading={busy === "update"}
									disabled={busy !== null}
								>
									Update yt-dlp
								</Button>
								<Button
									size="1"
									variant="soft"
									color="gray"
									onClick={() => void openExternal(check.releaseUrl)}
								>
									Release notes
								</Button>
							</Flex>
						)}
					</Callout.Root>
				)}

				{info?.ffmpeg.source === "missing" && (
					<Callout.Root color="red">
						<Callout.Icon>
							<Warning24Regular />
						</Callout.Icon>
						<Callout.Text>
							FFmpeg is missing. Audio conversion and merging will fail until
							it is installed. The app can download a verified static build
							into its own data folder.
						</Callout.Text>
						<Button
							size="1"
							mt="2"
							onClick={() => void repairFfmpeg()}
							loading={busy === "ffmpeg"}
							disabled={busy !== null}
						>
							<ArrowDownload24Regular />
							Download FFmpeg
						</Button>
					</Callout.Root>
				)}

				{failure && (
					<Callout.Root color="red" role="alert">
						<Callout.Text>{failure}</Callout.Text>
					</Callout.Root>
				)}

				<Separator size="4" />

				<Text weight="bold" size="2">
					Custom paths
				</Text>
				<Text size="1" color="gray">
					Leave these empty to use the bundled tools, an in-app update, or a
					system installation. A chosen file must respond to its version
					command before it is saved.
				</Text>
				<Flex gap="2" wrap="wrap" align="end">
					<Box style={{ flex: "1 1 260px" }}>
						<Text size="1" color="gray" as="div" mb="1">
							yt-dlp
						</Text>
						<TextField.Root
							value={ytPath}
							onChange={(event) => setYtPath(event.target.value)}
							placeholder="Automatic"
						/>
					</Box>
					<Button
						variant="soft"
						size="2"
						onClick={() => void chooseFile("yt-dlp")}
					>
						<FolderOpen24Regular />
						Choose
					</Button>
				</Flex>
				<Flex gap="2" wrap="wrap" align="end">
					<Box style={{ flex: "1 1 260px" }}>
						<Text size="1" color="gray" as="div" mb="1">
							FFmpeg
						</Text>
						<TextField.Root
							value={ffmpegPath}
							onChange={(event) => setFfmpegPath(event.target.value)}
							placeholder="Automatic"
						/>
					</Box>
					<Button
						variant="soft"
						size="2"
						onClick={() => void chooseFile("ffmpeg")}
					>
						<FolderOpen24Regular />
						Choose
					</Button>
				</Flex>
				<Flex gap="2" wrap="wrap">
					<Button size="1" onClick={() => void savePaths()}>
						Save paths
					</Button>
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => void repairFfmpeg()}
						loading={busy === "ffmpeg"}
						disabled={busy !== null}
					>
						Repair FFmpeg with a verified build
					</Button>
				</Flex>

				<Separator size="4" />

				<Text weight="bold" size="2">
					Cookies for sites that need a login
				</Text>
				<Text size="1" color="gray">
					Export a Netscape-format cookies.txt from your browser and choose it
					here. Cookies can grant access to your account, so keep the file
					private. It is read from this computer only and is never uploaded by
					TTML Tool. Delete it when you no longer need it.
				</Text>
				<Flex gap="2" wrap="wrap" align="end">
					<Box style={{ flex: "1 1 260px" }}>
						<TextField.Root
							value={cookiesFile}
							onChange={(event) => setCookiesFile(event.target.value)}
							placeholder="No cookies file"
						/>
					</Box>
					<Button
						variant="soft"
						size="2"
						onClick={() => void chooseFile("cookies")}
					>
						<FolderOpen24Regular />
						Choose
					</Button>
					<Button
						variant="soft"
						color="gray"
						size="2"
						onClick={() => setCookiesFile("")}
					>
						Clear
					</Button>
				</Flex>

				<Flex align="center" gap="3" wrap="wrap">
					<Switch
						checked={dailyCheck}
						onCheckedChange={setDailyCheck}
						id="downloader-daily-check"
					/>
					<Text size="2" as="label" htmlFor="downloader-daily-check">
						Check yt-dlp's official release once a day and show an update
						button
					</Text>
				</Flex>

				{testOutput && (
					<Card variant="surface" style={{ padding: 12 }}>
						<Text size="1" color="gray" as="div" mb="1">
							Test output
						</Text>
						<Code size="1" style={{ whiteSpace: "pre-wrap" }}>
							{testOutput}
						</Code>
					</Card>
				)}
			</Flex>
		</Card>
	);
}
