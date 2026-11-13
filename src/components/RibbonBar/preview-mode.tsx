/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接：
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link:
 *
 * https://github.com/bobjoerules/AMLL-TTML-TOOL/blob/main/LICENSE
 */

import { Button, Flex, Grid } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { type FC, forwardRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	Eye24Regular,
	FullScreenMaximize20Regular,
	FullScreenMinimize20Regular,
	Image16Regular,
	Image24Regular,
	LocalLanguage16Regular,
	People16Regular,
	Settings24Regular,
	Sparkle16Regular,
	TextT24Regular,
	TopSpeed16Regular,
	Translate16Regular,
	Warning16Regular,
} from "@fluentui/react-icons";
import {
	bgFollowsDuetAtom,
	hideObsceneWordsAtom,
	previewFullscreenAtom,
	previewShowAlbumArtworkAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import { UiLayer, uiLayerAtom } from "$/modules/settings/states";
import { RibbonFrame, RibbonSection } from "./common";

const previewToggleStyle = (active: boolean) => ({
	cursor: "pointer",
	justifyContent: "flex-start",
	gap: "6px",
	paddingLeft: "8px",
	paddingRight: "10px",
	height: "26px",
	fontSize: "12px",
	fontWeight: active ? 600 : 500,
});

const PreviewToggle: FC<{
	active: boolean;
	label: string;
	icon: ReactNode;
	onToggle: () => void;
	showTooltip?: boolean;
}> = ({ active, label, icon, onToggle, showTooltip }) => (
	<Button
		size="1"
		variant={active ? "solid" : "surface"}
		color={active ? undefined : "gray"}
		onClick={onToggle}
		aria-pressed={active}
		title={showTooltip ? label : undefined}
		style={previewToggleStyle(active)}
	>
		{icon}
		<span>{label}</span>
	</Button>
);

export const PreviewModeRibbonBar: FC<{ isSidebar?: boolean }> = forwardRef<
	HTMLDivElement,
	{ isSidebar?: boolean }
>(({ isSidebar }, ref) => {
	const [showTranslationLine, setShowTranslationLine] = useAtom(
		showTranslationLinesAtom,
	);
	const [showRomanLine, setShowRomanLine] = useAtom(showRomanLinesAtom);
	const [hideObsceneWords, setHideObsceneWords] = useAtom(hideObsceneWordsAtom);
	const [showFps, setShowFps] = useAtom(showFpsCounterAtom);
	const [spicySimpleMode, setSpicySimpleMode] = useAtom(
		spicySimpleLyricsModeAtom,
	);
	const [bgFollowsDuet, setBgFollowsDuet] = useAtom(bgFollowsDuetAtom);
	const [showArtwork, setShowArtwork] = useAtom(previewShowAlbumArtworkAtom);
	const [isFullscreen, setIsFullscreen] = useAtom(previewFullscreenAtom);
	const { t } = useTranslation();
	const isNew = useAtomValue(uiLayerAtom) === UiLayer.New;

	const gridColumns = isSidebar ? "1" : "2";
	const gridStyle = { width: isSidebar ? "100%" : undefined };
	const showTooltip = isNew;

	const simpleControl = (
		<PreviewToggle
			active={spicySimpleMode}
			onToggle={() => setSpicySimpleMode((v) => !v)}
			icon={<Sparkle16Regular />}
			label={t("ribbonBar.previewMode.simpleLyrics", "Simple Lyrics")}
			showTooltip={showTooltip}
		/>
	);

	const artworkControl = (
		<PreviewToggle
			active={showArtwork}
			onToggle={() => setShowArtwork((v) => !v)}
			icon={<Image16Regular />}
			label={t("ribbonBar.previewMode.showArtwork", "Album Artwork")}
			showTooltip={showTooltip}
		/>
	);

	const duetControl = (
		<PreviewToggle
			active={bgFollowsDuet}
			onToggle={() => setBgFollowsDuet((v) => !v)}
			icon={<People16Regular />}
			label={t("ribbonBar.previewMode.bgFollowsDuet", "Duet Layout")}
			showTooltip={showTooltip}
		/>
	);

	const fullscreenControl = !isSidebar ? (
		<PreviewToggle
			active={isFullscreen}
			onToggle={() => setIsFullscreen((v) => !v)}
			icon={
				isFullscreen ? (
					<FullScreenMinimize20Regular
						style={{ width: "16px", height: "16px" }}
					/>
				) : (
					<FullScreenMaximize20Regular
						style={{ width: "16px", height: "16px" }}
					/>
				)
			}
			label={t("ribbonBar.previewMode.fullscreen", "Fullscreen")}
			showTooltip={showTooltip}
		/>
	) : null;

	const translationControl = (
		<PreviewToggle
			active={showTranslationLine}
			onToggle={() => setShowTranslationLine((v) => !v)}
			icon={<LocalLanguage16Regular />}
			label={t("ribbonBar.previewMode.showTranslation", "Translation")}
			showTooltip={showTooltip}
		/>
	);

	const romanControl = (
		<PreviewToggle
			active={showRomanLine}
			onToggle={() => setShowRomanLine((v) => !v)}
			icon={<Translate16Regular />}
			label={t("ribbonBar.previewMode.showRoman", "Romanization")}
			showTooltip={showTooltip}
		/>
	);

	const obsceneControl = (
		<PreviewToggle
			active={hideObsceneWords}
			onToggle={() => setHideObsceneWords((v) => !v)}
			icon={<Warning16Regular />}
			label={t("ribbonBar.previewMode.maskObsceneWords", "Mask Obscene")}
			showTooltip={showTooltip}
		/>
	);

	const fpsControl = (
		<PreviewToggle
			active={showFps}
			onToggle={() => setShowFps((v) => !v)}
			icon={<TopSpeed16Regular />}
			label={t("ribbonBar.previewMode.showFps", "Show FPS")}
			showTooltip={showTooltip}
		/>
	);

	return (
		<RibbonFrame
			ref={ref}
			isSidebar={isSidebar}
			reserveControlRows={isNew ? 0 : 2}
		>
			{isNew ? (
				<>
					<RibbonSection
						isSidebar={isSidebar}
						label={
							<Flex gap="1" align="center">
								<TextT24Regular />
								{t("ribbonBar.previewMode.lyrics", "Lyrics")}
							</Flex>
						}						>
							<Grid
								data-preview-lyrics-controls=""
								columns={gridColumns}
								gap="1"
								gapX="2"
								align="center"
								style={gridStyle}
							>
								{simpleControl}
							{duetControl}
							{translationControl}
							{romanControl}
						</Grid>
					</RibbonSection>

					<RibbonSection
						isSidebar={isSidebar}
						label={
							<Flex gap="1" align="center">
								<Image24Regular />
								{t("ribbonBar.previewMode.display", "Display")}
							</Flex>
						}
					>
						<Grid
							columns={gridColumns}
							gap="1"
							gapX="2"
							align="center"
							style={gridStyle}
						>
							{artworkControl}
							{fullscreenControl}
						</Grid>
					</RibbonSection>

					<RibbonSection
						isSidebar={isSidebar}
						label={
							<Flex gap="1" align="center">
								<Settings24Regular />
								{t("ribbonBar.previewMode.advanced", "Advanced")}
							</Flex>
						}
					>
						<Grid
							columns={gridColumns}
							gap="1"
							gapX="2"
							align="center"
							style={gridStyle}
						>
							{obsceneControl}
							{fpsControl}
						</Grid>
					</RibbonSection>
				</>
			) : (
				<>
					{/* Classic keeps the original View / Lyrics grouping. */}
					<RibbonSection
						isSidebar={isSidebar}
						label={
							<Flex gap="1" align="center">
								<Eye24Regular />
								{t("ribbonBar.previewMode.view", "View")}
							</Flex>
						}						>
							<Grid
								data-preview-lyrics-controls=""
								columns={gridColumns}
								gap="1"
								gapX="2"
								align="center"
								style={gridStyle}
							>
								{simpleControl}
							{artworkControl}
							{duetControl}
							{fullscreenControl}
						</Grid>
					</RibbonSection>

					<RibbonSection
						isSidebar={isSidebar}
						label={
							<Flex gap="1" align="center">
								<TextT24Regular />
								{t("ribbonBar.previewMode.lyrics", "Lyrics")}
							</Flex>
						}
					>
						<Grid
							columns={gridColumns}
							gap="1"
							gapX="2"
							align="center"
							style={gridStyle}
						>
							{translationControl}
							{romanControl}
							{obsceneControl}
							{fpsControl}
						</Grid>
					</RibbonSection>
				</>
			)}
		</RibbonFrame>
	);
});

export default PreviewModeRibbonBar;
