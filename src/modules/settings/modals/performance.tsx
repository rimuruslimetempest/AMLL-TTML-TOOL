import { relaunch } from "@tauri-apps/plugin-process";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Select,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { PerformanceMode } from "$/design-system/types";
import {
	type PreviewFrameRateMode,
	previewFrameRateModeAtom,
	previewQualityAtom,
	previewQualityLevelAtom,
} from "$/modules/performance/states";
import { setPreviewStartupFlag } from "$/modules/performance/startup";
import type { QualityPreference } from "$/modules/performance/quality";
import {
	performanceModePreferenceAtom,
} from "$/modules/settings/states";
import { showFpsCounterAtom } from "$/modules/settings/states/preview";

const isWindows = /Windows/i.test(
	typeof navigator === "undefined" ? "" : navigator.userAgent,
);

const QUALITY_LABELS: Record<QualityPreference, string> = {
	auto: "Auto (recommended)",
	high: "High — all effects",
	medium: "Medium — no text glow",
	low: "Low — simplified backdrop",
};

export const SettingsPerformanceTab = memo(() => {
	const { t } = useTranslation();
	const [quality, setQuality] = useAtom(previewQualityAtom);
	const qualityLevel = useAtomValue(previewQualityLevelAtom);
	const [frameRateMode, setFrameRateMode] = useAtom(previewFrameRateModeAtom);
	const [showFps, setShowFps] = useAtom(showFpsCounterAtom);
	const [performancePreference, setPerformancePreference] = useAtom(
		performanceModePreferenceAtom,
	);
	const [restartNeeded, setRestartNeeded] = useState(false);

	const changeFrameRate = (value: string) => {
		const mode = value as PreviewFrameRateMode;
		setFrameRateMode(mode);
		setRestartNeeded(true);
		setPreviewStartupFlag("unlimited-frame-rate", mode === "unlimited").catch(
			() => {
				toast.error(
					"Could not save the frame-rate startup flag. The setting was stored, but it may not apply on restart.",
				);
			},
		);
	};

	const restart = () => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) return;
		relaunch().catch(() => {});
	};

	return (
		<Flex direction="column" gap="4">
			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.performance.qualityTitle", "Preview Quality")}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3" justify="between" wrap="wrap">
							<Box style={{ minWidth: 0 }}>
								<Text size="2" as="div">
									{t("settings.performance.quality", "Visual quality")}
								</Text>
								<Text size="1" color="gray" as="div">
									Auto lowers decoration only when frames miss the 60 FPS
									floor. Audio, input, and timing are never delayed.
								</Text>
							</Box>
							<Select.Root
								value={quality}
								onValueChange={(value) =>
									setQuality(value as QualityPreference)
								}
							>
								<Select.Trigger style={{ minWidth: 190 }} />
								<Select.Content>
									{(Object.keys(QUALITY_LABELS) as QualityPreference[]).map(
										(key) => (
											<Select.Item key={key} value={key}>
												{QUALITY_LABELS[key]}
											</Select.Item>
										),
									)}
								</Select.Content>
							</Select.Root>
						</Flex>
						{quality === "auto" ? (
							<Text size="1" color="gray">
								Current automatic level: {qualityLevel} of 3
							</Text>
						) : null}
					</Flex>
				</Card>
			</Box>

			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.performance.frameRateTitle", "Frame Rate")}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3" justify="between" wrap="wrap">
							<Box style={{ minWidth: 0 }}>
								<Text size="2" as="div">
									{t("settings.performance.frameRate", "Preview frame rate")}
								</Text>
								<Text size="1" color="gray" as="div">
									Match display uses requestAnimationFrame at the monitor's
									refresh rate and is the safest choice.
								</Text>
							</Box>
							<Select.Root
								value={frameRateMode}
								onValueChange={changeFrameRate}
								disabled={!isWindows}
							>
								<Select.Trigger style={{ minWidth: 190 }} />
								<Select.Content>
									<Select.Item value="match">Match display</Select.Item>
									<Select.Item value="unlimited">Unlimited (experimental)</Select.Item>
								</Select.Content>
							</Select.Root>
						</Flex>

						<Flex align="center" gap="2" wrap="wrap">
							<Badge color="amber" variant="soft">
								Experimental
							</Badge>
							<Text size="1" color="gray">
								{isWindows
									? "Unlimited passes extra WebView2 flags on the next launch. It may do nothing, or it may tear; Microsoft warns against shipping browser flags in production. A restart is required."
									: "Unlimited is only available on Windows. Other platforms already follow the display through the compositor."}
							</Text>
						</Flex>

						{restartNeeded ? (
							<Flex align="center" gap="3" wrap="wrap">
								<Text size="1" color="amber">
									Restart TTML Tool to apply this frame-rate change.
								</Text>
								<Button size="1" variant="soft" onClick={restart}>
									Restart now
								</Button>
							</Flex>
						) : null}
					</Flex>
				</Card>
			</Box>

			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.performance.diagnosticsTitle", "Diagnostics")}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3">
							<Checkbox
								checked={showFps}
								onCheckedChange={(value) => setShowFps(!!value)}
							/>
							<Text size="2">
								{t(
									"settings.performance.showDiagnostics",
									"Show frame diagnostics in Preview",
								)}
							</Text>
						</Flex>
						<Text size="1" color="gray">
							Shows FPS, detected refresh rate, average and 1% low frame
							times, the worst frame in five seconds, and a frame-time graph.
							Use Copy frame report to share the numbers.
						</Text>
					</Flex>
				</Card>
			</Box>

			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.performance.performanceModeTitle", "Performance Mode")}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3" justify="between" wrap="wrap">
							<Box style={{ minWidth: 0 }}>
								<Text size="2" as="div">
									{t("settings.performance.performanceMode", "Flatten app chrome")}
								</Text>
								<Text size="1" color="gray" as="div">
									Removes blur, glow, and background animation across the whole
									interface. Auto suggests it when the first measurement looks
									slow.
								</Text>
							</Box>
							<Select.Root
								value={performancePreference}
								onValueChange={(value) =>
									setPerformancePreference(value as PerformanceMode)
								}
							>
								<Select.Trigger style={{ minWidth: 190 }} />
								<Select.Content>
									<Select.Item value={PerformanceMode.Auto}>Auto</Select.Item>
									<Select.Item value={PerformanceMode.On}>On</Select.Item>
									<Select.Item value={PerformanceMode.Off}>Off</Select.Item>
								</Select.Content>
							</Select.Root>
						</Flex>
					</Flex>
				</Card>
			</Box>

			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.performance.gpuTitle", "Laptops and Multiple GPUs")}
				</Text>
				<Card variant="surface">
					<Text size="1" color="gray">
						If frames still dip, open Windows Settings → System → Display →
						Graphics, add TTML Tool, and choose High performance. Also check
						that Windows display settings use the monitor's full refresh rate.
						On hybrid laptops the integrated GPU may be driving the preview.
					</Text>
				</Card>
			</Box>
		</Flex>
	);
});
