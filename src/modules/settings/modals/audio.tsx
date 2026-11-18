import {
	ArchiveRegular,
	DeleteRegular,
	SaveRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Grid,
	IconButton,
	Select,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	customEqualizerPresetsAtom,
	EQ_FREQUENCIES,
	EQ_PRESETS,
	equalizerEnabledAtom,
	equalizerGainsAtom,
	equalizerPresetAtom,
} from "$/modules/audio/states/index.ts";
import {
	Mp3ConversionMode,
	mp3ConversionModeAtom,
} from "$/modules/settings/states";
import {
	CUE_SOUNDS,
	CUE_SOURCES,
	type CueSound,
	type CueSource,
	cueInPreviewAtom,
	cueMinGapMsAtom,
	cueSoundAtom,
	cueSourcesAtom,
	cuesEnabledAtom,
	cueVolumeAtom,
} from "$/modules/settings/states/cues";

const CUE_SOUND_LABEL_KEYS = {
	tick: "settings.audio.cuesSoundName.tick",
	click: "settings.audio.cuesSoundName.click",
	beep: "settings.audio.cuesSoundName.beep",
	woodblock: "settings.audio.cuesSoundName.woodblock",
} as const;

const CUE_SOUND_LABELS: Record<CueSound, string> = {
	tick: "Tick",
	click: "Click",
	beep: "Beep",
	woodblock: "Woodblock",
};

const CUE_SOURCE_LABEL_KEYS = {
	marks: "settings.audio.cuesSource.marks",
	sections: "settings.audio.cuesSource.sections",
	lines: "settings.audio.cuesSource.lines",
	words: "settings.audio.cuesSource.words",
} as const;

const CUE_SOURCE_LABELS: Record<CueSource, string> = {
	marks: "Cue markers",
	sections: "Section starts",
	lines: "Line starts",
	words: "Word starts",
};

export const AudioSettingsTab = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(equalizerEnabledAtom);
	const [gains, setGains] = useAtom(equalizerGainsAtom);
	const [preset, setPreset] = useAtom(equalizerPresetAtom);
	const [customPresets, setCustomPresets] = useAtom(customEqualizerPresetsAtom);
	const [newPresetName, setNewPresetName] = useState("");
	const [mp3ConversionMode, setMp3ConversionMode] = useAtom(
		mp3ConversionModeAtom,
	);
	const [cuesEnabled, setCuesEnabled] = useAtom(cuesEnabledAtom);
	const [cueVolume, setCueVolume] = useAtom(cueVolumeAtom);
	const [cueSound, setCueSound] = useAtom(cueSoundAtom);
	const [cueSources, setCueSources] = useAtom(cueSourcesAtom);
	const [cueInPreview, setCueInPreview] = useAtom(cueInPreviewAtom);
	const [cueMinGap, setCueMinGap] = useAtom(cueMinGapMsAtom);

	const toggleCueSource = useCallback(
		(source: CueSource, checked: boolean) => {
			setCueSources((previous) => {
				const next = new Set(previous);
				if (checked) next.add(source);
				else next.delete(source);
				// An empty selection would silently disable every cue.
				if (next.size === 0) return previous;
				return CUE_SOURCES.filter((item) => next.has(item));
			});
		},
		[setCueSources],
	);

	const allPresets = useMemo(
		() => ({
			...EQ_PRESETS,
			...customPresets,
		}),
		[customPresets],
	);

	const handleToggle = useCallback(
		(val: boolean) => {
			setEnabled(val);
			setTimeout(() => audioEngine.updateEqGains(), 0);
		},
		[setEnabled],
	);

	const handleGainChange = useCallback(
		(index: number, val: number) => {
			const newGains = [...gains];
			newGains[index] = val;
			setGains(newGains);
			setPreset("Custom");
			audioEngine.updateEqGains();
		},
		[gains, setGains, setPreset],
	);

	const handlePresetChange = useCallback(
		(val: string) => {
			setPreset(val);
			if (allPresets[val]) {
				setGains(allPresets[val]);
				setTimeout(() => audioEngine.updateEqGains(), 0);
			}
		},
		[setPreset, setGains, allPresets],
	);

	const handleSavePreset = useCallback(() => {
		if (!newPresetName.trim()) return;
		setCustomPresets((prev) => ({
			...prev,
			[newPresetName]: [...gains],
		}));
		setPreset(newPresetName);
		setNewPresetName("");
	}, [newPresetName, gains, setCustomPresets, setPreset]);

	const handleDeletePreset = useCallback(
		(name: string) => {
			setCustomPresets((prev) => {
				const next = { ...prev };
				delete next[name];
				return next;
			});
			if (preset === name) {
				handlePresetChange("Flat");
			}
		},
		[preset, setCustomPresets, handlePresetChange],
	);

	return (
		<Flex direction="column" gap="4">
			<Box>
				<Flex align="center" gap="4" mb="2">
					<Text weight="bold" size="3">
						{t("settings.audio.equalizer", "Audio Equalizer")}
					</Text>
					<Flex align="center" gap="2">
						<Switch checked={enabled} onCheckedChange={handleToggle} />
						<Text size="2" color="gray">
							{enabled
								? t("settings.common.enabled", "Enabled")
								: t("settings.common.disabled", "Disabled")}
						</Text>
					</Flex>
				</Flex>
				<Text size="2" color="gray" mb="4">
					{t(
						"settings.audio.eqDescription",
						"Adjust gains for different frequencies to optimize your audio experience.",
					)}
				</Text>
			</Box>

			<Flex
				direction="column"
				gap="3"
				style={{
					opacity: enabled ? 1 : 0.5,
					pointerEvents: enabled ? "auto" : "none",
				}}
			>
				<Flex align="center" gap="3" mb="2">
					<Text size="2" weight="bold">
						{t("settings.audio.preset", "Presets")}
					</Text>
					<Select.Root value={preset} onValueChange={handlePresetChange}>
						<Select.Trigger />
						<Select.Content>
							<Select.Group>
								<Select.Label>
									{t("settings.audio.standardPresets", "Standard")}
								</Select.Label>
								<Select.Item value="Custom">
									{t("settings.audio.presets.custom", "Manual")}
								</Select.Item>
								{Object.keys(EQ_PRESETS).map((p) => (
									<Select.Item key={p} value={p}>
										{p}
									</Select.Item>
								))}
							</Select.Group>
							{Object.keys(customPresets).length > 0 && (
								<Select.Group>
									<Select.Label>
										{t("settings.audio.customPresets", "Custom")}
									</Select.Label>
									{Object.keys(customPresets).map((p) => (
										<Select.Item key={p} value={p}>
											<Flex align="center" justify="between" width="100%">
												{p}
											</Flex>
										</Select.Item>
									))}
								</Select.Group>
							)}
						</Select.Content>
					</Select.Root>

					{customPresets[preset] && (
						<IconButton
							variant="ghost"
							color="red"
							size="1"
							onClick={() => handleDeletePreset(preset)}
						>
							<DeleteRegular />
						</IconButton>
					)}

					<Button
						variant="soft"
						size="1"
						onClick={() => handlePresetChange("Flat")}
					>
						{t("settings.audio.reset", "Reset")}
					</Button>
				</Flex>

				<Flex align="center" gap="2" mb="2">
					<TextField.Root
						placeholder={t("settings.audio.newPresetName", "New Preset Name")}
						value={newPresetName}
						onChange={(e) => setNewPresetName(e.target.value)}
						size="1"
						style={{ flexGrow: 1 }}
					>
						<TextField.Slot>
							<ArchiveRegular />
						</TextField.Slot>
					</TextField.Root>
					<Button
						size="1"
						onClick={handleSavePreset}
						disabled={!newPresetName.trim()}
					>
						<SaveRegular fontSize="14" />
						{t("settings.audio.save", "Save Preset")}
					</Button>
				</Flex>

				<Grid
					columns="10"
					gap="2"
					style={{ height: "200px", alignItems: "end" }}
				>
					{EQ_FREQUENCIES.map((freq, i) => (
						<Flex
							key={freq}
							direction="column"
							align="center"
							gap="2"
							height="100%"
						>
							<Flex
								direction="column"
								justify="end"
								height="160px"
								width="100%"
								align="center"
							>
								<Slider
									orientation="vertical"
									value={[gains[i]]}
									min={-12}
									max={12}
									step={1}
									onValueChange={([val]) => handleGainChange(i, val)}
								/>
							</Flex>
							<Text
								size="1"
								style={{ fontSize: "9px", textAlign: "center", width: "100%" }}
							>
								{freq >= 1000 ? `${freq / 1000}k` : freq}
							</Text>
							<Text size="1" color="gray" style={{ fontSize: "9px" }}>
								{gains[i] > 0 ? `+${gains[i]}` : gains[i]}dB
							</Text>
						</Flex>
					))}
				</Grid>
			</Flex>

			<Card>
				<Flex gap="3" align="center">
					<Box flexGrow="1">
						<Flex align="center" justify="between" gap="4">
							<Flex direction="column" gap="1">
								<Text>{t("settings.audio.mp3Conversion", "MP3 to FLAC")}</Text>
								<Text size="1" color="gray">
									{t(
										"settings.audio.mp3ConversionDesc",
										"Convert MP3 to FLAC when importing for better sync",
									)}
								</Text>
							</Flex>
							<Select.Root
								value={mp3ConversionMode}
								onValueChange={(val) =>
									setMp3ConversionMode(val as Mp3ConversionMode)
								}
							>
								<Select.Trigger />
								<Select.Content>
									<Select.Item value={Mp3ConversionMode.Ask}>
										{t("settings.audio.mp3ConversionAsk", "Ask")}
									</Select.Item>
									<Select.Item value={Mp3ConversionMode.Always}>
										{t("settings.audio.mp3ConversionAlways", "Auto")}
									</Select.Item>
									<Select.Item value={Mp3ConversionMode.Never}>
										{t("settings.audio.mp3ConversionNever", "Off")}
									</Select.Item>
								</Select.Content>
							</Select.Root>
						</Flex>
					</Box>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="3">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text weight="bold" size="3">
								{t("settings.audio.cues", "Audio Cues")}
							</Text>
							<Text size="1" color="gray">
								{t(
									"settings.audio.cuesDescription",
									"Click sounds while the playhead crosses cue points, so timing can be checked by ear. Monitoring only: cues are never written to the TTML.",
								)}
							</Text>
						</Flex>
						<Switch checked={cuesEnabled} onCheckedChange={setCuesEnabled} />
					</Flex>

					<Flex
						direction="column"
						gap="3"
						style={{
							opacity: cuesEnabled ? 1 : 0.5,
							pointerEvents: cuesEnabled ? "auto" : "none",
						}}
					>
						<Flex gap="3" align="end" wrap="wrap">
							<Box>
								<Text size="1" color="gray">
									{t("settings.audio.cuesSound", "Cue sound")}
								</Text>
								<Select.Root
									value={cueSound}
									onValueChange={(value) => setCueSound(value as CueSound)}
								>
									<Select.Trigger />
									<Select.Content>
										{CUE_SOUNDS.map((sound) => (
											<Select.Item key={sound} value={sound}>
												{t(
													CUE_SOUND_LABEL_KEYS[sound],
													CUE_SOUND_LABELS[sound],
												)}
											</Select.Item>
										))}
									</Select.Content>
								</Select.Root>
							</Box>
							<Button
								variant="soft"
								size="1"
								onClick={() => {
									void audioEngine.previewCueSound(cueSound);
								}}
							>
								{t("settings.audio.cuesPreview", "Preview")}
							</Button>
							<Box style={{ flexGrow: 1, minWidth: 160 }}>
								<Flex justify="between" align="center">
									<Text size="1" color="gray">
										{t("settings.audio.cuesVolume", "Cue volume")}
									</Text>
									<Text size="1" color="gray">
										{Math.round(cueVolume * 100)}%
									</Text>
								</Flex>
								<Slider
									value={[cueVolume]}
									min={0}
									max={1}
									step={0.05}
									onValueChange={([value]) => setCueVolume(value)}
								/>
							</Box>
						</Flex>

						<Flex gap="3" align="center" wrap="wrap">
							<Text size="1" color="gray">
								{t("settings.audio.cuesMinGap", "Minimum gap")}
							</Text>
							<TextField.Root
								type="number"
								min={0}
								max={1000}
								step={10}
								value={String(cueMinGap)}
								onChange={(event) => {
									const value = Number.parseInt(event.target.value, 10);
									if (!Number.isNaN(value)) {
										setCueMinGap(Math.max(0, Math.min(1000, value)));
									}
								}}
								style={{ width: 110 }}
							>
								<TextField.Slot side="right">
									{t("settings.audio.cuesMinGapUnit", "ms")}
								</TextField.Slot>
							</TextField.Root>
							<Text as="label" size="2" style={{ marginLeft: "auto" }}>
								<Flex align="center" gap="2">
									<Checkbox
										checked={cueInPreview}
										onCheckedChange={(checked) => setCueInPreview(!!checked)}
									/>
									{t(
										"settings.audio.cuesInPreview",
										"Play cues in Preview mode",
									)}
								</Flex>
							</Text>
						</Flex>

						<Box>
							<Text size="1" color="gray">
								{t("settings.audio.cuesSources", "Cue sources")}
							</Text>
							<Flex gap="4" wrap="wrap" mt="2">
								{CUE_SOURCES.map((source) => (
									<Text
										as="label"
										size="2"
										key={source}
										style={{ display: "inline-flex" }}
									>
										<Flex align="center" gap="2">
											<Checkbox
												checked={cueSources.includes(source)}
												onCheckedChange={(checked) =>
													toggleCueSource(source, !!checked)
												}
											/>
											{t(
												CUE_SOURCE_LABEL_KEYS[source],
												CUE_SOURCE_LABELS[source],
											)}
										</Flex>
									</Text>
								))}
							</Flex>
						</Box>

						<Text size="1" color="gray">
							{t(
								"settings.audio.cuesAddHint",
								'Alt+click the waveform or press the "Add cue at playhead" shortcut to place a cue.',
							)}
						</Text>
					</Flex>
				</Flex>
			</Card>
		</Flex>
	);
};
