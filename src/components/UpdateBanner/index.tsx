import {
	ArrowSync16Regular,
	CloudArrowDown16Regular,
	Dismiss16Regular,
} from "@fluentui/react-icons";
import { Badge, Button, Dialog, Flex, Progress, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { toast } from "react-toastify";
import {
	skippedUpdateVersionAtom,
	updateDialogOpenAtom,
} from "$/states/update";
import { useAppUpdate } from "$/utils/useAppUpdate";
import styles from "./index.module.css";

export function UpdateBanner() {
	const { status, update } = useAppUpdate();
	const [, setOpen] = useAtom(updateDialogOpenAtom);
	const skipped = useAtomValue(skippedUpdateVersionAtom);

	if (status !== "available" || !update || update.version === skipped)
		return null;

	return (
		<div className={styles.banner} role="status">
			<button
				type="button"
				className={styles.bannerButton}
				onClick={() => setOpen(true)}
			>
				<CloudArrowDown16Regular />
				<span>Update available</span>
				<Badge size="1" variant="soft" color="ruby">
					v{update.version}
				</Badge>
			</button>
		</div>
	);
}

export function UpdateDialog() {
	const [open, setOpen] = useAtom(updateDialogOpenAtom);
	const [skipped, setSkipped] = useAtom(skippedUpdateVersionAtom);
	const {
		status,
		update,
		progress,
		downloadedBytes,
		totalBytes,
		errorMsg,
		checkUpdate,
		installUpdate,
		relaunchApp,
	} = useAppUpdate();

	const skipVersion = () => {
		if (!update) return;
		setSkipped(update.version);
		setOpen(false);
		toast.info(`Skipped v${update.version}. You can check again anytime.`);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="540px">
				<Flex justify="between" align="start" gap="3">
					<Flex direction="column" gap="1">
						<Dialog.Title style={{ margin: 0 }}>
							{update ? `Update available: v${update.version}` : "Update"}
						</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							Updates are downloaded from GitHub Releases and installed only
							after you choose Update now.
						</Dialog.Description>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray" aria-label="Close">
							<Dismiss16Regular />
						</Button>
					</Dialog.Close>
				</Flex>

				{update?.body ? (
					<div className={styles.notes}>{update.body}</div>
				) : null}

				{status === "downloading" ? (
					<Flex direction="column" gap="2">
						<Flex justify="between">
							<Text size="2">Downloading update…</Text>
							<Text size="2">
								{totalBytes > 0
									? `${Math.round(progress)}% · ${(
											downloadedBytes /
											(1024 * 1024)
										).toFixed(1)} / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
									: `${Math.round(progress)}%`}
							</Text>
						</Flex>
						<Progress value={totalBytes > 0 ? progress : undefined} />
					</Flex>
				) : null}

				{status === "ready" ? (
					<Flex direction="column" gap="2">
						<Text size="2">
							The update is ready. Restart the app to finish installing it.
						</Text>
						<Flex gap="2">
							<Button onClick={relaunchApp}>
								<ArrowSync16Regular /> Restart now
							</Button>
							<Button variant="soft" onClick={() => setOpen(false)}>
								Later
							</Button>
						</Flex>
					</Flex>
				) : null}

				{status === "error" ? (
					<Flex direction="column" gap="2">
						<Text size="2" color="red">
							{errorMsg || "The update could not be installed."}
						</Text>
						<Flex gap="2">
							<Button variant="soft" onClick={() => checkUpdate(false)}>
								Try again
							</Button>
							<Button variant="ghost" onClick={() => setOpen(false)}>
								Later
							</Button>
						</Flex>
					</Flex>
				) : null}

				{status === "available" ? (
					<Flex gap="2" wrap="wrap">
						<Button onClick={installUpdate}>
							<CloudArrowDown16Regular /> Update now
						</Button>
						<Button variant="soft" onClick={() => setOpen(false)}>
							Later
						</Button>
						<Button variant="ghost" color="gray" onClick={skipVersion}>
							Skip this version
						</Button>
					</Flex>
				) : null}

				{status === "checking" ? (
					<Text size="2" color="gray">
						Checking for updates…
					</Text>
				) : null}

				{status === "up-to-date" ? (
					<Text size="2" color="green">
						You are on the latest version.
					</Text>
				) : null}

				{skipped && skipped === update?.version ? (
					<Text size="1" color="gray">
						This version is skipped. Use Check for updates to see it again.
					</Text>
				) : null}
			</Dialog.Content>
		</Dialog.Root>
	);
}
