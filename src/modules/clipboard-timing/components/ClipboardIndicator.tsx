import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { clipboardPayloadAtom } from "../states";

/** Small, always-visible reminder of what the last copy holds. */
export function ClipboardIndicator() {
	const { t } = useTranslation();
	const [payload, setPayload] = useAtom(clipboardPayloadAtom);
	if (!payload) return null;

	const timed =
		payload.kind === "line-text"
			? 0
			: payload.words.filter((word) => word.endTime > word.startTime).length;
	const label =
		payload.kind === "line-text"
			? t("clipboard.lineText", "Line text copied")
			: t("clipboard.timing", {
					count: timed,
					defaultValue: `Clipboard has timing for ${timed} word(s)`,
				});

	return (
		<Card
			size="1"
			variant="surface"
			style={{
				position: "fixed",
				right: 12,
				bottom: 84,
				zIndex: 35,
				maxWidth: 250,
			}}
		>
			<Flex align="center" gap="2">
				<Badge size="1" color="gray" variant="soft">
					{t("clipboard.title", "Clipboard")}
				</Badge>
				<Text size="1" style={{ flex: 1 }}>
					{label}
				</Text>
				<Button
					size="1"
					variant="ghost"
					color="gray"
					onClick={() => setPayload(null)}
				>
					×
				</Button>
			</Flex>
		</Card>
	);
}
