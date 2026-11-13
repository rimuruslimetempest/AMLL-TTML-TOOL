import { Button, DropdownMenu } from "@radix-ui/themes";
import {
	ArrowAutofitWidth20Regular,
	ArrowRedo20Regular,
	ArrowSwap20Regular,
	ArrowUndo20Regular,
	Clock20Regular,
	Delete20Regular,
	Search20Regular,
	SelectAllOff20Regular,
	SelectAllOn20Regular,
	Settings20Regular,
	Tag20Regular,
	TextAdd20Regular,
	TextGrammarCheckmark20Regular,
} from "@fluentui/react-icons";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { formatKeyBindings } from "$/utils/keybindings";
import { NewMenuIcon } from "../NewMenuIcon";
import { useTopMenuActions } from "../useTopMenuActions";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();

	const getShortcut = (key: string[] | undefined) =>
		key ? formatKeyBindings(key) : undefined;

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onUndo}
				shortcut={getShortcut(menu.undoKey)}
			>
				<NewMenuIcon>
					<ArrowUndo20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.undo">Undo</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onRedo}
				shortcut={getShortcut(menu.redoKey)}
			>
				<NewMenuIcon>
					<ArrowRedo20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.redo">Redo</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onOpenFind}
				shortcut={getShortcut(menu.findKey)}
			>
				<NewMenuIcon>
					<Search20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.find">Find...</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenReplace}
				shortcut={getShortcut(menu.replaceKey)}
			>
				<NewMenuIcon>
					<ArrowSwap20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.replace">Replace...</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onSelectAll}
				shortcut={getShortcut(menu.selectAllLinesKey)}
			>
				<NewMenuIcon>
					<SelectAllOn20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.selectAllLines">Select all lines</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onUnselectAll}
				shortcut={getShortcut(menu.selectAllLinesKey)}
			>
				<NewMenuIcon>
					<SelectAllOff20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.unselectAllLines">Deselect all lines</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onSelectInverted}>
				<NewMenuIcon>
					<ArrowSwap20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.invertSelectAllLines">
					Invert line selections
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSelectWordsOfMatchedSelection}
				shortcut={getShortcut(menu.selectWordsOfMatchedSelectionKey)}
			>
				<NewMenuIcon>
					<TextAdd20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.selectWordsOfMatchedSelection">
					Select words matching selection
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onDeleteSelection}>
				<NewMenuIcon>
					<Delete20Regular />
				</NewMenuIcon>
				<Trans i18nKey="contextMenu.deleteWords">Delete Selected Words</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenTimeShift}>
				<NewMenuIcon>
					<Clock20Regular />
				</NewMenuIcon>
				{t("topBar.menu.timeShift", "Time Shift...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenTimeStretch}>
				<NewMenuIcon>
					<ArrowAutofitWidth20Regular />
				</NewMenuIcon>
				{t("topBar.menu.timeStretch", "Time Stretch...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenMetadataEditor}>
				<NewMenuIcon>
					<Tag20Regular />
				</NewMenuIcon>
				<Trans i18nKey="topBar.menu.editMetadata">Edit lyrics metadata…</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenSettings}>
				<NewMenuIcon>
					<Settings20Regular />
				</NewMenuIcon>
				<Trans i18nKey="settingsDialog.title">Settings</Trans>
			</DropdownMenu.Item>
		</>
	);
};

export const EditMenu = (props: EditMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<NewMenuIcon>
						<TextGrammarCheckmark20Regular />
					</NewMenuIcon>
					<Trans i18nKey="topBar.menu.edit">Edit</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<EditMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button
						variant="ghost"
						className="topMenuBarButton"
						style={props.buttonStyle}
					>
						<Trans i18nKey="topBar.menu.edit">Edit</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<EditMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
