import {
	ArrowReset24Regular,
	Color24Regular,
	TopSpeed24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	Kbd,
	SegmentedControl,
	Switch,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type CSSProperties, memo } from "react";
import { useTranslation } from "react-i18next";
import { uiFallbackNoticeAtom } from "$/design-system/state";
import { ContrastMode, Density, PerformanceMode } from "$/design-system/types";
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

const settingTextStyle: CSSProperties = {
	flex: "1 1 240px",
	minWidth: 0,
};
const settingControlStyle: CSSProperties = {
	flexShrink: 0,
	marginLeft: "auto",
};

export const PresentationSettings = memo(() => {
	const [uiLayer, setUiLayer] = useAtom(uiLayerAtom);
	const [performancePreference, setPerformancePreference] = useAtom(
		performanceModePreferenceAtom,
	);
	const performanceMode = useAtomValue(performanceModeAtom);
	const [density, setDensity] = useAtom(densityAtom);
	const [contrast, setContrast] = useAtom(contrastAtom);
	const setFallbackNotice = useSetAtom(uiFallbackNoticeAtom);
	const [askMatching, setAskMatching] = useAtom(askBeforeMatchingWordEditsAtom);
	const [newAccent, setNewAccent] = useAtom(newAccentColorAtom);
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

			<Card id="appearance-ui-layer">
				<Flex gap="3" align="start">
					<Color24Regular />
					<Box flexGrow="1">
						<Flex align="start" justify="between" gap="4" wrap="wrap">
							<Box style={settingTextStyle}>
								<Text weight="bold" as="div">
									{t("settings.appearance.interface.layer", "Interface Layer")}
								</Text>
								<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
									{t(
										"settings.appearance.interface.layerDesc",
										"Choose the visual language used by the title bar, ribbons, dialogs, and controls.",
									)}
								</Text>
							</Box>
							<SegmentedControl.Root
								value={uiLayer}
								onValueChange={selectUiLayer}
								size="1"
								style={settingControlStyle}
							>
								<SegmentedControl.Item value={UiLayer.New}>
									{t("settings.appearance.interface.new", "New")}
								</SegmentedControl.Item>
								<SegmentedControl.Item value={UiLayer.Classic}>
									{t("settings.appearance.interface.classic", "Classic")}
								</SegmentedControl.Item>
							</SegmentedControl.Root>
						</Flex>
						<Text size="1" color="gray" as="div" style={{ marginTop: 8 }}>
							{uiLayer === UiLayer.Classic
								? t(
										"settings.appearance.interface.classicDesc",
										"Flat, denser chrome with square corners and solid panels. Your colors and layout choices are preserved.",
									)
								: t(
										"settings.appearance.interface.newDesc",
										"Modern rounded surfaces with the refreshed design system, responsive spacing, and accessible controls.",
									)}
						</Text>
						<Flex align="center" gap="2" wrap="wrap" style={{ marginTop: 10 }}>
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
					</Box>
				</Flex>
			</Card>

			{uiLayer === UiLayer.New ? (
				<Card id="appearance-new-accent">
					<Flex gap="3" align="start">
						<Color24Regular />
						<Box flexGrow="1">
							<Flex align="start" justify="between" gap="4" wrap="wrap">
								<Box style={settingTextStyle}>
									<Text weight="bold" as="div">
										{t(
											"settings.appearance.interface.accent",
											"Accent color",
										)}
									</Text>
									<Text
										size="1"
										color="gray"
										as="div"
										style={{ marginTop: 4 }}
									>
										{t(
											"settings.appearance.interface.accentDesc",
											"Sets the accent used by the New interface. Classic keeps its existing colors.",
										)}
									</Text>
								</Box>
								<Flex
									align="center"
									gap="2"
									style={settingControlStyle}
								>
									<input
										type="color"
										value={newAccent}
										onChange={(event) => setNewAccent(event.target.value)}
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
										onClick={() => setNewAccent(DEFAULT_NEW_ACCENT_COLOR)}
									>
										{t(
											"settings.appearance.interface.accentReset",
											"Reset",
										)}
									</Button>
								</Flex>
							</Flex>
						</Box>
					</Flex>
				</Card>
			) : null}

			<Card id="appearance-density-contrast">
				<Flex gap="3" align="start">
					<Color24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="4">
							<Flex align="start" justify="between" gap="4" wrap="wrap">
								<Box style={settingTextStyle}>
									<Text weight="bold" as="div">
										{t("settings.appearance.interface.density", "Density")}
									</Text>
									<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
										{t(
											"settings.appearance.interface.densityDesc",
											"Compact reduces vertical spacing without shrinking text or removing controls.",
										)}
									</Text>
								</Box>
								<SegmentedControl.Root
									value={density}
									onValueChange={(value) => setDensity(value as Density)}
									size="1"
									style={settingControlStyle}
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
							</Flex>

							<Flex align="start" justify="between" gap="4" wrap="wrap">
								<Box style={settingTextStyle}>
									<Text weight="bold" as="div">
										{t("settings.appearance.interface.contrast", "Contrast")}
									</Text>
									<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
										{t(
											"settings.appearance.interface.contrastDesc",
											"High contrast strengthens borders and text to meet WCAG AA readability.",
										)}
									</Text>
								</Box>
								<SegmentedControl.Root
									value={contrast}
									onValueChange={(value) => setContrast(value as ContrastMode)}
									size="1"
									style={settingControlStyle}
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
							</Flex>
						</Flex>
					</Box>
				</Flex>
			</Card>

			<Card id="appearance-performance-mode">
				<Flex gap="3" align="start">
					<TopSpeed24Regular />
					<Box flexGrow="1">
						<Flex align="start" justify="between" gap="4" wrap="wrap">
							<Box style={settingTextStyle}>
								<Flex align="center" gap="2">
									<Text weight="bold">
										{t(
											"settings.appearance.interface.performance",
											"Performance Mode",
										)}
									</Text>
									<Badge
										size="1"
										color={performanceMode ? "amber" : "gray"}
										variant="soft"
									>
										{performanceLabel}
									</Badge>
								</Flex>
								<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
									{t(
										"settings.appearance.interface.performanceDesc",
										"Removes backdrop blur, decorative transitions, and layout motion while keeping every editing feature available.",
									)}
								</Text>
							</Box>
							<SegmentedControl.Root
								value={performancePreference}
								onValueChange={(value) =>
									setPerformancePreference(value as PerformanceMode)
								}
								size="1"
								style={settingControlStyle}
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
						</Flex>
						<Text
							size="1"
							color={
								performancePreference === PerformanceMode.Auto
									? "gray"
									: "amber"
							}
							as="div"
							style={{ marginTop: 8 }}
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
					</Box>
				</Flex>
			</Card>

			<Card id="appearance-matching-words">
				<Flex gap="3" align="start" justify="between" wrap="wrap">
					<Box flexGrow="1" style={settingTextStyle}>
						<Text weight="bold" as="div">
							{t(
								"settings.appearance.matchingWords.title",
								"Ask before applying edits to matching words",
							)}
						</Text>
						<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
							{t(
								"settings.appearance.matchingWords.desc",
								"After you rename a word, offer to rename its other occurrences. The prompt never applies anything by itself, skips locked or claimed lines, and keeps timing. Default: on.",
							)}
						</Text>
					</Box>
					<Switch
						checked={askMatching}
						onCheckedChange={setAskMatching}
						aria-label={t(
							"settings.appearance.matchingWords.title",
							"Ask before applying edits to matching words",
						)}
						style={settingControlStyle}
					/>
				</Flex>
			</Card>

			<Card id="appearance-reset-ui">
				<Flex gap="3" align="start" justify="between" wrap="wrap">
					<Box flexGrow="1" style={settingTextStyle}>
						<Text weight="bold" as="div">
							{t("settings.appearance.interface.reset", "Reset UI")}
						</Text>
						<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
							{t(
								"settings.appearance.interface.resetDesc",
								"If the New interface is ever hard to use, switch back to Classic here. Your editor, project data, and preferences stay intact.",
							)}
						</Text>
					</Box>
					<Button
						variant="soft"
						color="red"
						disabled={uiLayer === UiLayer.Classic}
						style={settingControlStyle}
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
				</Flex>
			</Card>
		</Flex>
	);
});
