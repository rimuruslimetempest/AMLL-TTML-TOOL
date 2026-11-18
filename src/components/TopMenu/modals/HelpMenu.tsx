import {
	ArrowDownload20Regular,
	ArrowSync20Regular,
	BookOpen20Regular,
	Code20Regular,
	DocumentText20Regular,
	History20Regular,
	Shield20Regular,
	Sparkle20Regular,
} from "@fluentui/react-icons";
import { Button, DropdownMenu } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { buildReportProblemUrl, RELEASES_URL } from "$/config/links";
import { APP_VERSION } from "$/modules/changelog/data";
import {
	guideExportedAtom,
	guidePanelOpenAtom,
	guideStepAtom,
	guideWelcomeOpenAtom,
} from "$/modules/onboarding/states";
import {
	privacyPolicyDialogAtom as privacyPolicyAtom,
	termsDialogAtom as termsAtom,
} from "$/modules/privacy/states";
import {
	changelogDialogAtom,
	settingsDialogAtom,
	settingsTabAtom,
	whatsNewDialogAtom,
} from "$/states/dialogs.ts";
import { openExternal } from "$/utils/openExternal";
import { useAppUpdate } from "$/utils/useAppUpdate";
import { NewMenuIcon } from "../NewMenuIcon";
import { useTopMenuActions } from "../useTopMenuActions";

type HelpMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const isWebsite =
	!import.meta.env.TAURI_ENV_PLATFORM &&
	!(
		typeof window !== "undefined" &&
		(window as unknown as { __TAURI__?: unknown }).__TAURI__
	);

const HelpMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const setChangelogOpen = useSetAtom(changelogDialogAtom);
	const setWhatsNewOpen = useSetAtom(whatsNewDialogAtom);
	const setPrivacyPolicyOpen = useSetAtom(privacyPolicyAtom);
	const setTermsOpen = useSetAtom(termsAtom);
	const setGuideWelcomeOpen = useSetAtom(guideWelcomeOpenAtom);
	const setGuidePanelOpen = useSetAtom(guidePanelOpenAtom);
	const setGuideStep = useSetAtom(guideStepAtom);
	const setGuideExported = useSetAtom(guideExportedAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const { checkUpdate } = useAppUpdate();

	return (
		<>
			<DropdownMenu.Item
				onSelect={() => {
					setGuideWelcomeOpen(false);
					setGuideExported(false);
					setGuideStep(0);
					setGuidePanelOpen(true);
				}}
			>
				<NewMenuIcon>
					<BookOpen20Regular />
				</NewMenuIcon>
				{t("beginnerGuide.menu", "Start Guide")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenGitHub}>
				<NewMenuIcon>
					<Code20Regular />
				</NewMenuIcon>
				GitHub
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenWiki}>
				<NewMenuIcon>
					<BookOpen20Regular />
				</NewMenuIcon>
				{t("topBar.menu.helpDoc", "Documentation")}
			</DropdownMenu.Item>
			{isWebsite && (
				<DropdownMenu.Item
					onSelect={() =>
						window.open(
							"https://github.com/rimuruslimetempest/ttml-tool/releases/latest",
							"_blank",
							"noopener,noreferrer",
						)
					}
				>
					<NewMenuIcon>
						<ArrowDownload20Regular />
					</NewMenuIcon>
					{t("topBar.menu.downloadApp", "Download Desktop App")}
				</DropdownMenu.Item>
			)}
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={() => setWhatsNewOpen(true)}>
				<NewMenuIcon>
					<Sparkle20Regular />
				</NewMenuIcon>
				What's New
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => setChangelogOpen(true)}>
				<NewMenuIcon>
					<History20Regular />
				</NewMenuIcon>
				Changelog & Updates
			</DropdownMenu.Item>
			{!isWebsite && (
				<DropdownMenu.Item
					onSelect={() => {
						setSettingsTab("about");
						setSettingsOpen(true);
						void checkUpdate(false);
					}}
				>
					<NewMenuIcon>
						<ArrowSync20Regular />
					</NewMenuIcon>
					Check for updates
				</DropdownMenu.Item>
			)}
			{RELEASES_URL && (
				<DropdownMenu.Item onSelect={() => openExternal(RELEASES_URL)}>
					<NewMenuIcon>
						<ArrowDownload20Regular />
					</NewMenuIcon>
					Releases
				</DropdownMenu.Item>
			)}
			<DropdownMenu.Item
				onSelect={() => openExternal(buildReportProblemUrl(APP_VERSION))}
			>
				<NewMenuIcon>
					<DocumentText20Regular />
				</NewMenuIcon>
				Report a problem
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={() => setPrivacyPolicyOpen(true)}>
				<NewMenuIcon>
					<Shield20Regular />
				</NewMenuIcon>
				Privacy Policy
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => setTermsOpen(true)}>
				<NewMenuIcon>
					<DocumentText20Regular />
				</NewMenuIcon>
				Terms of Use
			</DropdownMenu.Item>
		</>
	);
};

export const HelpMenu = (props: HelpMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<NewMenuIcon>
						<BookOpen20Regular />
					</NewMenuIcon>
					<Trans i18nKey="topBar.menu.help">Help</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<HelpMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger>
					<Button
						variant="ghost"
						className="topMenuBarButton"
						style={props.buttonStyle}
					>
						<Trans i18nKey="topBar.menu.help">Help</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<HelpMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
