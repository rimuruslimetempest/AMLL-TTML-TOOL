import { ArrowDownload16Regular, Play16Regular } from "@fluentui/react-icons";
import { Badge, Box, Button, Flex, Text } from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { toast } from "react-toastify";
import { audioErrorAtom } from "$/modules/audio/states";
import { collabMediaUrl, formatFileSize } from "$/modules/collab/logic";
import { globalStore } from "$/states/store";
import { openExternal } from "$/utils/openExternal";
import { loadSharedAudio } from "./shared-audio";
import { collabMediaAtom, collabRoleAtom, collabSessionAtom } from "./states";
import type { CollabSharedMedia } from "./types";

export function CollabFiles({ showEmpty = false }: { showEmpty?: boolean }) {
	const media = useAtomValue(collabMediaAtom);
	const session = useAtomValue(collabSessionAtom);
	const role = useAtomValue(collabRoleAtom);
	const [loadingId, setLoadingId] = useState<string | null>(null);
	if (!session) return null;
	if (media.length === 0 && !showEmpty) return null;
	const activeSession = session;

	const loadAudio = async (item: CollabSharedMedia) => {
		setLoadingId(item.id);
		try {
			await loadSharedAudio(activeSession, item);
			toast.success(`Loaded "${item.name}" without saving a copy.`, {
				toastId: `collab-audio-manual-${item.id}`,
			});
		} catch (error) {
			if (!globalStore.get(audioErrorAtom)) {
				toast.error(
					error instanceof Error
						? error.message
						: "Could not load the shared song.",
				);
			}
		} finally {
			setLoadingId(null);
		}
	};

	const hasAudio = media.some((item) => item.kind === "audio");

	return (
		<Box
			style={{
				padding: "0 10px 8px",
				borderBottom: "1px solid var(--gray-a4)",
			}}
		>
			<Flex align="center" justify="between" gap="2" mb="1">
				<Text size="1" weight="bold">
					Shared files
				</Text>
				{role && role !== "host" && hasAudio && (
					<Text size="1" color="gray">
						Songs load without saving
					</Text>
				)}
			</Flex>
			{media.length === 0 ? (
				<Text as="div" size="1" color="gray">
					The host has not shared a song or recording yet.
				</Text>
			) : (
				<Flex
					direction="column"
					gap="1"
					style={{ maxHeight: 150, overflowY: "auto" }}
				>
					{media.map((item) => (
						<Flex
							key={item.id}
							align="center"
							justify="between"
							gap="2"
							style={{
								padding: "5px 7px",
								borderRadius: 8,
								background: "var(--gray-a3)",
							}}
						>
							<Box style={{ minWidth: 0, flex: 1 }}>
								<Text
									as="div"
									size="1"
									weight="bold"
									style={{
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
									title={item.name}
								>
									{item.name}
								</Text>
								<Flex align="center" gap="1">
									<Badge size="1" variant="soft">
										{item.kind === "recording" ? "Recording" : "Song"}
									</Badge>
									<Text size="1" color="gray">
										{formatFileSize(item.size)}
									</Text>
								</Flex>
							</Box>
							<Flex align="center" gap="1">
								{role && role !== "host" && item.kind === "audio" && (
									<Button
										size="1"
										variant="soft"
										loading={loadingId === item.id}
										disabled={loadingId !== null && loadingId !== item.id}
										onClick={() => void loadAudio(item)}
										aria-label={`Load ${item.name} in the player`}
									>
										<Play16Regular /> Load
									</Button>
								)}
								<Button
									size="1"
									variant="soft"
									onClick={() => {
										const url = collabMediaUrl(activeSession, item.id);
										if (isTauri()) {
											void openExternal(url);
											return;
										}
										const link = document.createElement("a");
										link.href = url;
										link.download = item.name;
										document.body.appendChild(link);
										link.click();
										link.remove();
									}}
									aria-label={`Download ${item.name}`}
								>
									<ArrowDownload16Regular /> Download
								</Button>
							</Flex>
						</Flex>
					))}
				</Flex>
			)}
		</Box>
	);
}
