import {
	ArrowReset24Regular,
	Color24Regular,
	TopSpeed24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Flex,
	Heading,
	Kbd,
	SegmentedControl,
	Switch,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { uiFallbackNoticeAtom } from "$/design-system/state";
import { ContrastMode, Density, PerformanceMode } from "$/design-system/types";
import {
	resetThemeSelectionAtom,
	themeAccentOverrideAtom,
} from "$/modules/themes/state";
import {
	askBeforeMatchingWordEditsAtom,
	contrastAtom,
	DEFAULT_NEW_ACCENT_COLOR,
	densityAtom,
	newAccentColorAtom,
	performanceModeAtom,
	performanceModePreferenceAtom,
	UiLayer,
	uiLayerAtom,
} from "$/modules/settings/states";
import { SettingRow } from "../components/SettingRow";
import { SettingsSection } from "../components/SettingsSection";

export const PresentationSettings = memo(() => {
	const [uiLayer, setUiLayer] = useAtom(uiLayerAtom);
	const [performancePreference, setPerformancePreference] = useAtom(
		performanceModePreferenceAtom,
	);
	const performanceMode = useAtomValue(performanceModeAtom);
	const [density, setDensity] = useAtom(densityAtom);
	const [contrast, setContrast] = useAtom(contrastAtom);
	const setFallbackNotice = useSetAtom(uiFallbackNoticeAtom);
	const [askMatching, setAskMatching] = useAtom(
		askBeforeMatchingWordEditsAtom,
	);
	const [newAccent, setNewAccent] = useAtom(newAccentColorAtom);
	const [, setThemeAccentOverride] = useAtom(themeAccentOverrideAtom);
	const resetThemeSelection = useSetAtom(resetThemeSelectionAtom);
	const { t } = useTranslation();
	const performanceLabel =
		performancePreference === PerformanceMode.On
			? t("settings.appearance.interface.performanceOn", "On")
			: performancePreference === PerformanceMode.Auto
				? t("settings.appearance.interface.performanceAuto", "Auto")
				: t("settings.appearance.interface.performanceOff", "Off");

	const selectUiLayer = (value: string) => {
		setFallbackNotice(false);
		setUiLayer(value as UiLayer);
	};

	return (
		<Flex direction="column" gap="3">
			<Flex align="center" gap="2">
				<Color24Regular />
				<Heading size="4" style={{ margin: 0 }}>
					{t("settings.appearance.interface.title", "Interface")}
				</Heading>
			</Flex>

			<SettingsSection
				id="appearance-ui-layer"
				icon={<Color24Regular />}
				title={t("settings.appearance.interface.layer", "Interface Layer")}
				description={
					uiLayer === UiLayer.Classic
						? t(
								"settings.appearance.interface.classicDesc",
								"Flat, denser chrome with square corners and solid panels. Your colors and layout choices are preserved.",
							)
						: t(
								"settings.appearance.interface.newDesc",
								"Modern rounded surfaces with the refreshed design system, responsive spacing, and accessible controls.",
							)
				}
				actions={
					<SegmentedControl.Root
						value={uiLayer}
						onValueChange={selectUiLayer}
						size="1"
					>
						<SegmentedControl.Item value={UiLayer.New}>
							{t("settings.appearance.interface.new", "New")}
						</SegmentedControl.Item>
						<SegmentedControl.Item value={UiLayer.Classic}>
							{t("settings.appearance.interface.classic", "Classic")}
						</SegmentedControl.Item>
					</SegmentedControl.Root>
				}
			>
				<Flex align="center" gap="2" wrap="wrap">
					<Text size="1" color="gray">
						{t(
							"settings.appearance.interface.classicShortcut",
							"Emergency switch:",
						)}
					</Text>
					<Kbd size="1">Ctrl</Kbd>
					<Kbd size="1">Shift</Kbd>
					<Kbd size="1">Alt</Kbd>
					<Kbd size="1">C</Kbd>
				</Flex>
			</SettingsSection>

			{uiLayer === UiLayer.New ? (
				<SettingsSection
					id="appearance-new-accent"
					icon={<Color24Regular />}
					title={t("settings.appearance.interface.accent", "Accent color")}
					description={t(
						"settings.appearance.interface.accentDesc",
						"Themes supply their own accent. Pick a color to override it; Reset returns to the theme accent. Classic keeps its existing colors.",
					)}
					actions={
						<Flex align="center" gap="2" wrap="wrap">
							<input
								type="color"
								value={newAccent}
								onChange={(event) => {
									setThemeAccentOverride(true);
									setNewAccent(event.target.value);
								}}
								aria-label={t(
									"settings.appearance.interface.accent",
									"Accent color",
								)}
								style={{
									width: 42,
									height: 32,
									padding: 3,
									border: "1px solid var(--gray-a6)",
									borderRadius: 7,
									background: "transparent",
									cursor: "pointer",
								}}
							/>
							<Text
								size="1"
								color="gray"
								style={{
									fontFamily: "var(--code-font-family, monospace)",
								}}
							>
								{newAccent.toUpperCase()}
							</Text>
							<Button
								size="1"
								variant="soft"
								onClick={() => {
									setNewAccent(DEFAULT_NEW_ACCENT_COLOR);
									setThemeAccentOverride(false);
								}}
							>
								{t(
									"settings.appearance.interface.accentReset",
									"Use theme accent",
								)}
							</Button>
						</Flex>
					}
				/>
			) : null}

			<SettingsSection
				id="appearance-density-contrast"
				icon={<Color24Regular />}
				title={t(
					"settings.appearance.interface.densityContrast",
					"Density & contrast",
				)}
			>
				<SettingRow
					label={t("settings.appearance.interface.density", "Density")}
					description={t(
						"settings.appearance.interface.densityDesc",
						"Compact reduces vertical spacing without shrinking text or removing controls.",
					)}
					control={
						<SegmentedControl.Root
							value={density}
							onValueChange={(value) => setDensity(value as Density)}
							size="1"
							title={t(
								"settings.appearance.interface.newOnly",
								"Applies to the New interface. Classic is unchanged.",
							)}
						>
							<SegmentedControl.Item value={Density.Comfortable}>
								{t(
									"settings.appearance.interface.densityComfortable",
									"Comfortable",
								)}
							</SegmentedControl.Item>
							<SegmentedControl.Item value={Density.Compact}>
								{t(
									"settings.appearance.interface.densityCompact",
									"Compact",
								)}
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					}
				/>
				<SettingRow
					label={t("settings.appearance.interface.contrast", "Contrast")}
					description={t(
						"settings.appearance.interface.contrastDesc",
						"High contrast strengthens borders and text to meet WCAG AA readability.",
					)}
					control={
						<SegmentedControl.Root
							value={contrast}
							onValueChange={(value) => setContrast(value as ContrastMode)}
							size="1"
							title={t(
								"settings.appearance.interface.newOnly",
								"Applies to the New interface. Classic is unchanged.",
							)}
						>
							<SegmentedControl.Item value={ContrastMode.Standard}>
								{t(
									"settings.appearance.interface.contrastStandard",
									"Standard",
								)}
							</SegmentedControl.Item>
							<SegmentedControl.Item value={ContrastMode.High}>
								{t("settings.appearance.interface.contrastHigh", "High")}
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					}
				/>
			</SettingsSection>

			<SettingsSection
				id="appearance-performance-mode"
				icon={<TopSpeed24Regular />}
				title={t(
					"settings.appearance.interface.performance",
					"Performance Mode",
				)}
				badge={
					<Badge
						size="1"
						color={performanceMode ? "amber" : "gray"}
						variant="soft"
					>
						{performanceLabel}
					</Badge>
				}
				description={t(
					"settings.appearance.interface.performanceDesc",
					"Removes backdrop blur, decorative transitions, and layout motion while keeping every editing feature available.",
				)}
				actions={
					<SegmentedControl.Root
						value={performancePreference}
						onValueChange={(value) =>
							setPerformancePreference(value as PerformanceMode)
						}
						size="1"
					>
						<SegmentedControl.Item value={PerformanceMode.Off}>
							{t("settings.appearance.interface.performanceOff", "Off")}
						</SegmentedControl.Item>
						<SegmentedControl.Item value={PerformanceMode.Auto}>
							{t("settings.appearance.interface.performanceAuto", "Auto")}
						</SegmentedControl.Item>
						<SegmentedControl.Item value={PerformanceMode.On}>
							{t("settings.appearance.interface.performanceOn", "On")}
						</SegmentedControl.Item>
					</SegmentedControl.Root>
				}
			>
				<Text
					size="1"
					color={
						performancePreference === PerformanceMode.Auto ? "gray" : "amber"
					}
				>
					{performancePreference === PerformanceMode.Auto
						? t(
								"settings.appearance.interface.performanceAutoNote",
								"Auto measures frame pacing after startup and suggests Performance Mode if rendering is slow. It never switches without your approval.",
							)
						: performancePreference === PerformanceMode.On
							? t(
									"settings.appearance.interface.performanceNote",
									"Best for low-power machines, large projects, or remote desktop sessions. Colors and project data are unchanged.",
								)
							: t(
									"settings.appearance.interface.performanceOffNote",
									"All visual effects stay enabled. Choose Auto to receive a non-blocking suggestion if this device struggles.",
								)}
				</Text>
			</SettingsSection>

			<SettingsSection
				id="appearance-matching-words"
				title={t("settings.appearance.matchingWords.section", "Word edits")}
			>
				<SettingRow
					label={t(
						"settings.appearance.matchingWords.title",
						"Ask before applying edits to matching words",
					)}
					description={t(
						"settings.appearance.matchingWords.desc",
						"After you rename a word, offer to rename its other occurrences. The prompt never applies anything by itself, skips locked or claimed lines, and keeps timing. Default: on.",
					)}
					control={
						<Switch
							checked={askMatching}
							onCheckedChange={setAskMatching}
							aria-label={t(
								"settings.appearance.matchingWords.title",
								"Ask before applying edits to matching words",
							)}
						/>
					}
				/>
			</SettingsSection>

			<SettingsSection
				id="appearance-reset-ui"
				icon={<ArrowReset24Regular />}
				title={t("settings.appearance.interface.reset", "Reset UI")}
				description={t(
					"settings.appearance.interface.resetDesc",
					"If the New interface is ever hard to use, switch back to Classic here. Your editor, project data, and preferences stay intact.",
				)}
			>
				<Flex gap="2" wrap="wrap">
					<Button
						variant="soft"
						color="red"
						disabled={uiLayer === UiLayer.Classic}
						onClick={() => {
							setFallbackNotice(false);
							setUiLayer(UiLayer.Classic);
						}}
						title={t(
							"settings.appearance.interface.resetShortcut",
							"Shortcut: Ctrl+Shift+Alt+C",
						)}
					>
						<ArrowReset24Regular />
						{t(
							"settings.appearance.interface.resetAction",
							"Reset UI to Classic",
						)}
					</Button>
					<Button
						variant="soft"
						disabled={uiLayer === UiLayer.Classic}
						onClick={resetThemeSelection}
						title="Shortcut: Ctrl+Shift+Alt+T"
					>
						Reset theme
					</Button>
				</Flex>
			</SettingsSection>
		</Flex>
	);
});
