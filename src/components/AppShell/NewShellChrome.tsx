import {
	Chat16Regular,
	CheckmarkCircle16Regular,
	Edit16Regular,
	History16Regular,
	People16Regular,
	Play16Regular,
	Search16Regular,
	Timer16Regular,
	Translate16Regular,
} from "@fluentui/react-icons";
import { Badge, Button, Flex, SegmentedControl, Text, Tooltip } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { AvatarDot, RoleBadge } from "$/modules/collab/ui";
import {
	collabCommentsAtom,
	collabDialogOpenAtom,
	collabMembersAtom,
	collabPanelAtom,
	collabRoleAtom,
	collabSessionAtom,
	collabWaitingAtom,
} from "$/modules/collab/states";
import { openCommentCount } from "$/modules/collab/model";
import { UiLayer, uiLayerAtom } from "$/modules/settings/states";
import { findReplaceStateAtom } from "$/states/dialogs";
import { ToolMode, toolModeAtom } from "$/states/main";
import styles from "./shell.module.css";

function ToolButton({
	label,
	icon,
	count,
	onClick,
	active,
}: {
	label: string;
	icon: React.ReactNode;
	count?: number;
	onClick: () => void;
	active?: boolean;
}) {
	return (
		<Tooltip content={label}>
			<Button
				variant={active ? "soft" : "ghost"}
				color={active ? undefined : "gray"}
				size="1"
				onClick={onClick}
				className={styles.toolButton}
				aria-label={label}
			>
				{icon}
				<span className={styles.toolLabel}>{label}</span>
				{count ? (
					<Badge size="1" variant="solid" className={styles.countBadge}>
						{count > 99 ? "99+" : count}
					</Badge>
				) : null}
			</Button>
		</Tooltip>
	);
}

export function NewTitleBarCluster() {
	const uiLayer = useAtomValue(uiLayerAtom);
	const members = useAtomValue(collabMembersAtom);
	const waiting = useAtomValue(collabWaitingAtom);
	const session = useAtomValue(collabSessionAtom);
	const role = useAtomValue(collabRoleAtom);
	const comments = useAtomValue(collabCommentsAtom);
	const [panel, setPanel] = useAtom(collabPanelAtom);
	const setDialogOpen = useSetAtom(collabDialogOpenAtom);
	if (uiLayer !== UiLayer.New) return null;

	const openCount = openCommentCount(comments);

	return (
		<Flex align="center" gap="1" className={styles.topCluster} data-new-chrome="top">
			{session ? (
				<button
					type="button"
					className={styles.avatarStack}
					onClick={() => setPanel("members")}
					title="Room people"
					aria-label="Room people"
				>
					{members.slice(0, 3).map((member) => (
						<AvatarDot key={member.id} member={member} size={22} />
					))}
					{members.length > 3 ? (
						<span className={styles.avatarMore}>+{members.length - 3}</span>
					) : null}
				</button>
			) : null}
			<RoleBadge role={role} />
			{session ? (
				<Flex align="center" gap="1">
					<ToolButton
						label="People"
						icon={<People16Regular />}
						count={waiting.length}
						active={panel === "members"}
						onClick={() => setPanel("members")}
					/>
					<ToolButton
						label="Comments"
						icon={<Chat16Regular />}
						count={openCount}
						active={panel === "comments"}
						onClick={() => setPanel("comments")}
					/>
				</Flex>
			) : (
				<Button size="1" variant="soft" onClick={() => setDialogOpen(true)}>
					<People16Regular /> Collaborate
				</Button>
			)}
		</Flex>
	);
}

export function NewBottomBar() {
	const uiLayer = useAtomValue(uiLayerAtom);
	const session = useAtomValue(collabSessionAtom);
	const [toolMode, setToolMode] = useAtom(toolModeAtom);
	const [panel, setPanel] = useAtom(collabPanelAtom);
	const setFind = useSetAtom(findReplaceStateAtom);
	const comments = useAtomValue(collabCommentsAtom);
	const { t } = useTranslation();
	// This is the live-room strip. Solo editing already has the title-bar mode
	// switch and keyboard Find, so don't take up a row when no room is active.
	if (uiLayer !== UiLayer.New || !session) return null;

	return (
		<div className={styles.bottomBar} data-new-chrome="bottom" data-ui-chrome="bottombar">
			<SegmentedControl.Root
				value={toolMode}
				onValueChange={(value) => setToolMode(value as ToolMode)}
				size="1"
			>
				<SegmentedControl.Item value={ToolMode.Edit}>
					<Flex align="center" gap="1" px="1">
						<Edit16Regular />
						<span className={styles.toolLabel}>{t("topBar.modeBtns.edit", "Edit")}</span>
					</Flex>
				</SegmentedControl.Item>
				<SegmentedControl.Item value={ToolMode.Sync}>
					<Flex align="center" gap="1" px="1">
						<Timer16Regular />
						<span className={styles.toolLabel}>{t("topBar.modeBtns.sync", "Sync")}</span>
					</Flex>
				</SegmentedControl.Item>
				<SegmentedControl.Item value={ToolMode.Preview}>
					<Flex align="center" gap="1" px="1">
						<Play16Regular />
						<span className={styles.toolLabel}>
							{t("topBar.modeBtns.preview", "Preview")}
						</span>
					</Flex>
				</SegmentedControl.Item>
			</SegmentedControl.Root>

			<div className={styles.divider} />
			<ToolButton
				label={t("newShell.find", "Find")}
				icon={<Search16Regular />}
				onClick={() =>
					setFind((previous) => ({
						...previous,
						open: true,
						replaceMode: false,
					}))
				}
			/>
			<ToolButton
				label={t("newShell.comments", "Comments")}
				icon={<Chat16Regular />}
				count={openCommentCount(comments)}
				active={panel === "comments"}
				onClick={() => setPanel("comments")}
			/>
			<ToolButton
				label={t("newShell.review", "Review")}
				icon={<CheckmarkCircle16Regular />}
				active={panel === "review"}
				onClick={() => setPanel("review")}
			/>
			<ToolButton
				label={t("newShell.translation", "Translate")}
				icon={<Translate16Regular />}
				active={panel === "translation"}
				onClick={() => setPanel("translation")}
			/>
			<ToolButton
				label={t("newShell.history", "History")}
				icon={<History16Regular />}
				active={panel === "history"}
				onClick={() => setPanel("history")}
			/>
			<div style={{ flex: 1 }} />
			<Text size="1" color="gray" className={styles.hintText}>
				Room changes are saved to this project, never into TTML.
			</Text>
		</div>
	);
}
