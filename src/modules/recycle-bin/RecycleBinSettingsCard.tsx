import { ArrowCounterclockwise24Regular } from "@fluentui/react-icons";
import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { binByteSize } from "./logic";
import { recycleBinDialogAtom } from "./state";
import { loadRecycleBin } from "./storage";
import type { RecycleBinFile } from "./types";

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function RecycleBinSettingsCard() {
	const setOpen = useSetAtom(recycleBinDialogAtom);
	const [bin, setBin] = useState<RecycleBinFile | null>(null);

	useEffect(() => {
		void loadRecycleBin().then(setBin);
	}, []);

	return (
		<Card variant="surface">
			<Flex align="center" justify="between" gap="3" wrap="wrap">
				<Flex direction="column" gap="1">
					<Text weight="bold" size="3">
						Recycle bin
					</Text>
					<Text size="1" color="gray">
						{bin
							? `${bin.items.length} item${bin.items.length === 1 ? "" : "s"} · ${formatBytes(binByteSize(bin))} · kept for ${
									bin.settings.retentionDays === "never"
										? "as long as you want"
										: `${bin.settings.retentionDays} days`
								}`
							: "Loading…"}
					</Text>
					<Text size="1" color="gray">
						Deleted lines, words, projects, saved splits, and themes can be
						restored here before they are removed permanently.
					</Text>
				</Flex>
				<Button variant="soft" onClick={() => setOpen(true)}>
					<ArrowCounterclockwise24Regular />
					Open recycle bin
				</Button>
			</Flex>
		</Card>
	);
}
