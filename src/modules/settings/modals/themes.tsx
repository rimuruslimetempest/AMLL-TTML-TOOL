import {
	PaintBrush24Regular,
	ShieldCheckmark24Regular,
} from "@fluentui/react-icons";
import { Box, Button, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { settingsTabAtom } from "$/states/dialogs";
import {
	resetThemeSelectionAtom,
	themeCssSafeModeAtom,
	themeCustomCssAtom,
	themeCustomCssEnabledAtom,
} from "$/modules/themes/state";
import {
	ThemeAdvancedCard,
	ThemeSettingsCard,
} from "$/modules/themes/ThemeSettings";
import { ThemePairStudio } from "$/modules/studio/ThemeStudio";
import { SettingRow } from "../components/SettingRow";
import { SettingsSection } from "../components/SettingsSection";

export function SettingsThemesTab() {
	const { t } = useTranslation();
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const [safeMode, setSafeMode] = useAtom(themeCssSafeModeAtom);
	const setCustomCss = useSetAtom(themeCustomCssAtom);
	const setCustomCssEnabled = useSetAtom(themeCustomCssEnabledAtom);
	const resetThemeSelection = useSetAtom(resetThemeSelectionAtom);

	return (
		<Flex direction="column" gap="3">
			<ThemePairStudio />

			<ThemeSettingsCard />

			<SettingsSection
				id="themes-safe-mode"
				icon={<ShieldCheckmark24Regular />}
				title={t("settings.themes.safety.title", "Theme safety")}
				description={t(
					"settings.themes.safety.desc",
					"If a theme paints over the interface, turn off theme CSS without losing your colors or project data. Token colors stay active.",
				)}
			>
				<SettingRow
					label={t(
						"settings.themes.safety.disable",
						"Disable theme CSS",
					)}
					description={t(
						"settings.themes.safety.disableDesc",
						"Stops the selected theme's stylesheet and Custom CSS from applying. The theme's color tokens and the rest of the app stay active.",
					)}
					control={
						<Switch
							checked={safeMode}
							onCheckedChange={setSafeMode}
							aria-label={t(
								"settings.themes.safety.disable",
								"Disable theme CSS",
							)}
						/>
					}
				/>
				<Flex gap="2" wrap="wrap">
					<Button
						variant="soft"
						color="amber"
						disabled={safeMode}
						onClick={() => setSafeMode(true)}
					>
						{t(
							"settings.themes.safety.disableAction",
							"Disable theme CSS now",
						)}
					</Button>
					<Button
						variant="soft"
						onClick={() => {
							setSafeMode(false);
							resetThemeSelection();
						}}
					>
						{t("settings.themes.safety.resetTheme", "Reset theme")}
					</Button>
					<Button
						variant="soft"
						onClick={() => {
							setCustomCss("");
							setCustomCssEnabled(false);
						}}
					>
						{t(
							"settings.themes.safety.resetCss",
							"Reset custom CSS",
						)}
					</Button>
				</Flex>
			</SettingsSection>

			<ThemeAdvancedCard />

			<Card>
				<Flex align="center" justify="between" gap="3" wrap="wrap">
					<Flex align="start" gap="2">
						<PaintBrush24Regular
							style={{ flex: "0 0 auto", marginTop: 2 }}
						/>
						<Box>
							<Text weight="bold" as="div">
								{t(
									"settings.themes.legacy.title",
									"Legacy appearance presets",
								)}
							</Text>
							<Text size="1" color="gray" as="div" style={{ marginTop: 4 }}>
								{t(
									"settings.themes.legacy.desc",
									"The old built-in preset grid now lives with themes. Saved custom presets remain under Appearance → Legacy appearance presets.",
								)}
							</Text>
						</Box>
					</Flex>
					<Button
						variant="soft"
						onClick={() => setSettingsTab("appearance")}
					>
						{t("settings.themes.legacy.open", "Open Appearance")}
					</Button>
				</Flex>
			</Card>
		</Flex>
	);
}
