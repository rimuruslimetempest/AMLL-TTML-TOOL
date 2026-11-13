import {
	ArrowClockwise16Regular,
	ChevronDownFilled,
	ChevronUpFilled,
	ClockRegular,
	MusicNote2Filled,
	PauseFilled,
	PlayFilled,
	RecordRegular,
	SettingsFilled,
	Speaker224Regular,
} from "@fluentui/react-icons";
import {
	Popover,
	Slider,
	Switch,
	Tooltip,
} from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type FC, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	currentDurationAtom,
	currentTimeAtom,
	playbackRateAtom,
	preservesPitchAtom,
	spectrogramVisibleAtom,
	volumeAtom,
} from "$/modules/audio/states";
import { screenRecorderDialogOpenAtom } from "$/modules/recorder/states";
import {
	settingsDialogAtom,
	settingsTabAtom,
	timeShiftPreviewActiveAtom,
} from "$/states/dialogs";
import {
	msToTimestamp,
} from "$/utils/timestamp";
import { AudioSlider } from "./AudioSlider";
import { TimelineRuler } from "./TimelineRuler";
import styles from "./NewTransportBar.module.css";

export interface NewTransportBarProps {
	audioLoaded: boolean;
	audioPlaying: boolean;
	onLoadMusic: () => void;
	onTogglePlay: () => void;
	onOpenUrlDialog: () => void;
}

export const NewTransportBar: FC<NewTransportBarProps> = ({
	audioLoaded,
	audioPlaying,
	onLoadMusic,
	onTogglePlay,
	onOpenUrlDialog,
}) => {
	const { t } = useTranslation();
	const currentTime = useAtomValue(currentTimeAtom);
	const currentDuration = useAtomValue(currentDurationAtom);
	const [volume, setVolume] = useAtom(volumeAtom);
	const [playbackRate, setPlaybackRate] = useAtom(playbackRateAtom);
	const [preservesPitch, setPreservesPitch] = useAtom(preservesPitchAtom);
	const [spectrogramVisible, setSpectrogramVisible] = useAtom(
		spectrogramVisibleAtom,
	);
	const [timeShiftActive, setTimeShiftActive] = useAtom(
		timeShiftPreviewActiveAtom,
	);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const setRecorderOpen = useSetAtom(screenRecorderDialogOpenAtom);
	const [optionsOpen, setOptionsOpen] = useState(false);

	const onToggleSpectrogram = useCallback(() => {
		setSpectrogramVisible((previous) => !previous);
	}, [setSpectrogramVisible]);

	const onOpenTimeShift = useCallback(() => {
		setTimeShiftActive((previous) => !previous);
		if (!spectrogramVisible) setSpectrogramVisible(true);
		setOptionsOpen(false);
	}, [setSpectrogramVisible, setTimeShiftActive, spectrogramVisible]);

	const onOpenSpectrogramSettings = useCallback(() => {
		setSettingsTab("audio");
		setSettingsOpen(true);
		setOptionsOpen(false);
	}, [setSettingsOpen, setSettingsTab]);

	const onLoadFromUrl = useCallback(() => {
		onOpenUrlDialog();
		setOptionsOpen(false);
	}, [onOpenUrlDialog]);

	const onResetAudio = useCallback(async () => {
		await audioEngine.recreateContext();
		toast.success(t("audioPanel.audioResetSuccess", "Audio engine reset"));
		setOptionsOpen(false);
	}, [t]);

	const onOpenRecorder = useCallback(() => {
		setRecorderOpen(true);
		setOptionsOpen(false);
	}, [setRecorderOpen]);

	const playLabel = audioPlaying
		? t("audioPanel.pause", "Pause")
		: t("audioPanel.play", "Play");

	return (
		<section
			className={styles.transport}
			aria-label={t("audioPanel.transport", "Audio transport")}
		>
			<div className={styles.left}>
				<button
					type="button"
					className={styles.loadButton}
					onClick={onLoadMusic}
					title={t("audioPanel.openAudioFile", "Open Local Audio File")}
					aria-label={t("audioPanel.openAudioFile", "Open Local Audio File")}
				>
					<MusicNote2Filled />
					<span className={styles.loadLabel}>
						{audioLoaded
							? t("audioPanel.replaceAudio", "Replace audio")
							: t("audioPanel.loadAudio", "Load audio")}
					</span>
				</button>

				<button
					type="button"
					className={styles.playButton}
					onClick={onTogglePlay}
					disabled={!audioLoaded}
					aria-label={playLabel}
					title={playLabel}
				>
					{audioPlaying ? <PauseFilled /> : <PlayFilled />}
				</button>

				<div className={styles.timeBlock}>
					<span className={styles.currentTime}>{msToTimestamp(currentTime)}</span>
					<span className={styles.duration}>
						{audioLoaded
							? msToTimestamp(currentDuration)
							: t("audioPanel.noAudio", "No audio loaded")}
					</span>
				</div>
			</div>

			<div className={styles.center}>
				<TimelineRuler />
				<div className={styles.waveWell}>
					<AudioSlider height="56px" />
				</div>
			</div>

			<div className={styles.right}>
				<div className={styles.volume}>
					<Speaker224Regular className={styles.volumeIcon} />
					<Slider
						className={styles.volumeSlider}
						min={0}
						max={1}
						step={0.01}
						value={[volume]}
						onValueChange={(value) => setVolume(value[0])}
						aria-label={t("audioPanel.volume", "Volume")}
					/>
				</div>

				<Popover.Root>
					<Popover.Trigger asChild>
						<button
							type="button"
							className={`${styles.chip} ${
								playbackRate !== 1 ? styles.chipActive : ""
							}`}
							title={t("audioPanel.playbackRate", "Playback Speed")}
							aria-label={t("audioPanel.playbackRate", "Playback Speed")}
						>
							{playbackRate.toFixed(2)}×
						</button>
					</Popover.Trigger>
					<Popover.Content
						className={styles.popover}
						side="top"
						align="end"
						sideOffset={10}
					>
						<div className={styles.popoverHeader}>
							<span>{t("audioPanel.playbackRate", "Playback Speed")}</span>
							<span className={styles.popoverValue}>
								{playbackRate.toFixed(2)}×
							</span>
						</div>
						<Slider
							min={0.1}
							max={2}
							step={0.05}
							value={[playbackRate]}
							onValueChange={(value) => setPlaybackRate(value[0])}
							aria-label={t("audioPanel.playbackRate", "Playback Speed")}
						/>
						<div className={styles.switchRow}>
							<span>{t("audioPanel.preservesPitch", "Preserve Pitch")}</span>
							<Switch
								checked={preservesPitch}
								onCheckedChange={setPreservesPitch}
								aria-label={t("audioPanel.preservesPitch", "Preserve Pitch")}
							/>
						</div>
						<p className={styles.hint}>
							{t(
								"audioPanel.speedHint",
								"Playback speed is local only. Timing data is untouched.",
							)}
						</p>
					</Popover.Content>
				</Popover.Root>

				<Tooltip
					content={t(
						"audioPanel.expandSpectrogram",
						"Expand / Collapse Spectrogram",
					)}
				>
					<button
						type="button"
						className={styles.iconButton}
						onClick={onToggleSpectrogram}
						aria-label={t(
							"audioPanel.expandSpectrogram",
							"Expand / Collapse Spectrogram",
						)}
						aria-pressed={spectrogramVisible}
					>
						{spectrogramVisible ? <ChevronDownFilled /> : <ChevronUpFilled />}
					</button>
				</Tooltip>

				<Popover.Root open={optionsOpen} onOpenChange={setOptionsOpen}>
					<Popover.Trigger asChild>
						<button
							type="button"
							className={styles.iconButton}
							aria-label={t("audioPanel.audioTools", "Audio tools")}
							title={t("audioPanel.audioTools", "Audio tools")}
						>
							<SettingsFilled />
						</button>
					</Popover.Trigger>
					<Popover.Content
						className={styles.popover}
						side="top"
						align="end"
						sideOffset={10}
					>
						<div className={styles.menu}>
							<span className={styles.menuLabel}>
								{t("audioPanel.audioTools", "Audio tools")}
							</span>
							<div className={styles.menuRow}>
								<span>{t("audioPanel.volume", "Volume")}</span>
								<Slider
									className={styles.menuSlider}
									min={0}
									max={1}
									step={0.01}
									value={[volume]}
									onValueChange={(value) => setVolume(value[0])}
									aria-label={t("audioPanel.volume", "Volume")}
								/>
								<span className={styles.menuValue}>
									{Math.round(volume * 100)}%
								</span>
							</div>
							<button
								type="button"
								className={styles.menuItem}
								onClick={onOpenTimeShift}
							>
								<ClockRegular />
								<span>{t("timeShiftDialog.title", "Time Shift")}</span>
								{timeShiftActive ? (
									<span className={styles.menuState}>ON</span>
								) : null}
							</button>
							<button
								type="button"
								className={styles.menuItem}
								onClick={onOpenSpectrogramSettings}
							>
								<SettingsFilled />
								<span>
									{t("spectrogram.settings", "Spectrogram Settings")}
								</span>
							</button>
							<button
								type="button"
								className={styles.menuItem}
								onClick={onLoadFromUrl}
							>
								<MusicNote2Filled />
								<span>
									{t("audioPanel.loadFromUrl", "Load Audio from URL…")}
								</span>
							</button>
							<div className={styles.menuSeparator} />
							<button
								type="button"
								className={styles.menuItem}
								onClick={onResetAudio}
							>
								<ArrowClockwise16Regular />
								<span>{t("audioPanel.resetAudio", "Reset Audio Engine")}</span>
							</button>
							{isTauri() ? (
								<button
									type="button"
									className={styles.menuItem}
									onClick={onOpenRecorder}
								>
									<RecordRegular />
									<span>{t("audioPanel.recordScreen", "Record screen")}</span>
								</button>
							) : null}
							<div className={styles.menuSeparator} />
							<p className={styles.hint}>
								{t(
									"audioPanel.localHint",
									"Audio stays on this device. No timing data is created here.",
								)}
							</p>
						</div>
					</Popover.Content>
				</Popover.Root>
			</div>
		</section>
	);
};
