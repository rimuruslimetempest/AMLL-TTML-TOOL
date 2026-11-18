import { Delete16Regular } from "@fluentui/react-icons";
import {
	Box,
	Flex,
	IconButton,
	Popover,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WaveSurfer from "wavesurfer.js";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioBufferAtom,
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
	spectrogramVisibleAtom,
} from "$/modules/audio/states";
import { toggleMarkAt, updateMarkAt } from "$/modules/project/logic/marks";
import {
	accentColorAtom,
	activePresetIdAtom,
	advancedWaveformColorAtom,
	advancedWaveformProgressColorAtom,
	customAccentColorAtom,
	useCustomAccentAtom,
} from "$/modules/settings/states";
import { previewFullscreenAtom } from "$/modules/settings/states/preview";
import {
	spectrogramContainerWidthAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import {
	isDarkThemeAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import type { Mark } from "$/types/ttml";
import { msToTimestamp } from "$/utils/timestamp";
import { subscribePreviewClock } from "$/components/SpicyLyrics/clock";
import { performanceModeAtom } from "$/modules/settings/states";
import { waveformQualityAtom } from "$/modules/settings/states/preview";
import { clampScroll, useHoverGuide } from "../hooks";
import { AudioRegion } from "./AudioRegion";
import styles from "./AudioSlider.module.css";
import { HoverGuide } from "./HoverGuide";

const FALLBACK_WAVE_COLOR = "#4c9aff";
const FALLBACK_PROGRESS_COLOR = "#a8ceff";

const usableCanvasColor = (value: string, fallback: string) => {
	const trimmed = value.trim();
	if (
		!trimmed ||
		trimmed.includes("var(") ||
		trimmed === "transparent" ||
		trimmed === "rgba(0, 0, 0, 0)"
	) {
		return fallback;
	}
	return trimmed;
};

const WaveformMarkers = memo(
	({
		markers,
		updateMark,
		toggleMark,
	}: {
		markers: (Mark & { left: number; timestamp: string })[];
		updateMark: (timeMs: number, data: Partial<Mark>) => void;
		toggleMark: (timeMs: number) => void;
	}) => {
		return (
			<>
				{markers.map((marker) => (
					<MarkerItem
						key={marker.timeMs}
						marker={marker}
						updateMark={updateMark}
						toggleMark={toggleMark}
					/>
				))}
			</>
		);
	},
);

const InteractiveHoverOverlay = memo(
	({
		spectrogramVisible,
		onMouseDown,
		hoverState,
		title,
	}: {
		spectrogramVisible: boolean;
		onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
		hoverState: {
			x: number;
			timeStr: string;
			isNearRight: boolean;
			isVisible: boolean;
		};
		title?: string;
	}) => {
		return (
			<>
				<div
					className={`${styles.interactionOverlay} ${
						spectrogramVisible ? styles.interactionOverlayActive : ""
					}`}
					onMouseDown={spectrogramVisible ? onMouseDown : undefined}
					onContextMenu={(e) => e.preventDefault()}
					title={title}
				/>
				<HoverGuide hoverState={hoverState} />
			</>
		);
	},
);

const MarkerItem = memo(
	({
		marker,
		updateMark,
		toggleMark,
	}: {
		marker: Mark & { left: number; timestamp: string };
		updateMark: (timeMs: number, data: Partial<Mark>) => void;
		toggleMark: (timeMs: number) => void;
	}) => {
		const { t } = useTranslation();
		const [localLabel, setLocalLabel] = useState(marker.label || "");
		const [localDescription, setLocalDescription] = useState(
			marker.description || "",
		);

		// Sync with external state changes
		useEffect(() => {
			setLocalLabel(marker.label || "");
		}, [marker.label]);

		useEffect(() => {
			setLocalDescription(marker.description || "");
		}, [marker.description]);

		const commitChanges = useCallback(() => {
			if (
				localLabel !== (marker.label || "") ||
				localDescription !== (marker.description || "")
			) {
				updateMark(marker.timeMs, {
					label: localLabel,
					description: localDescription,
				});
			}
		}, [localLabel, localDescription, marker, updateMark]);

		return (
			<Popover.Root onOpenChange={(open) => !open && commitChanges()}>
				<Popover.Trigger asChild>
					<div
						className={styles.markingLine}
						style={{ left: `${marker.left}px` }}
						onContextMenu={(e) => {
							e.preventDefault();
							if (e.shiftKey) toggleMark(marker.timeMs);
						}}
					>
						<div className={styles.markingLineTip}>
							{marker.label ? `${marker.label} ` : ""}
							{marker.timestamp}
						</div>
					</div>
				</Popover.Trigger>
				<Popover.Content
					size="1"
					style={{ width: 240, zIndex: 100 }}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<Flex direction="column" gap="2">
						<Box>
							<Text size="1" weight="bold" color="gray">
								{t("audio.marker", "Marker")} @ {marker.timestamp}
							</Text>
						</Box>
						<TextField.Root
							size="1"
							placeholder={t("audio.markerLabel", "Label (e.g. Verse 1 Start)")}
							value={localLabel}
							onChange={(e) => setLocalLabel(e.target.value)}
							onBlur={commitChanges}
						/>
						<TextArea
							size="1"
							placeholder={t("audio.markerDescription", "Description...")}
							value={localDescription}
							onChange={(e) => setLocalDescription(e.target.value)}
							onBlur={commitChanges}
							style={{ height: 60 }}
						/>
						<Flex justify="end" gap="2">
							<IconButton
								size="1"
								variant="ghost"
								color="red"
								onClick={() => toggleMark(marker.timeMs)}
								title={t("audio.deleteMarker", "Delete Marker")}
							>
								<Delete16Regular />
							</IconButton>
						</Flex>
					</Flex>
				</Popover.Content>
			</Popover.Root>
		);
	},
);

export interface AudioSliderProps {
	/** Waveform height. Classic keeps the legacy 2.5em; New uses a fixed deck height. */
	height?: string;
}

export const AudioSlider = memo(({ height = "2.5em" }: AudioSliderProps) => {
	const { t } = useTranslation();
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setCurrentDuration = useSetAtom(currentDurationAtom);
	const setAudioPlaying = useSetAtom(audioPlayingAtom);

	const currentDuration = useAtomValue(currentDurationAtom);
	const [lyricLines, setLyricLines] = useAtom(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);

	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const accentColor = useAtomValue(accentColorAtom);
	const useCustomAccent = useAtomValue(useCustomAccentAtom);
	const customAccentColor = useAtomValue(customAccentColorAtom);
	const advWaveformColor = useAtomValue(advancedWaveformColorAtom);
	const advWaveformProgress = useAtomValue(advancedWaveformProgressColorAtom);
	const activePresetId = useAtomValue(activePresetIdAtom);
	const performanceMode = useAtomValue(performanceModeAtom);
	const waveformQuality = useAtomValue(waveformQualityAtom);

	const spectrogramVisible = useAtomValue(spectrogramVisibleAtom);
	const setScrollLeft = useSetAtom(spectrogramScrollLeftAtom);
	const zoom = useAtomValue(spectrogramZoomAtom);
	const containerWidth = useAtomValue(spectrogramContainerWidthAtom);
	const spectrogramVisibleRef = useRef(spectrogramVisible);

	const wsContainerRef = useRef<HTMLDivElement>(null);
	const waveSurferRef = useRef<WaveSurfer | null>(null);
	const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
	const fallbackPlayheadRef = useRef<HTMLDivElement>(null);

	const [sliderWidthPx, setSliderWidthPx] = useState(0);
	const isDraggingRef = useRef(false);

	// Preview already has one animation loop for the lyrics. The waveform is a
	// secondary readout there, so it must not re-render React or redraw the
	// WaveSurfer canvas 60-144 times a second. Keep the editor's smooth playhead
	// untouched and sample Preview at 10 Hz instead.
	const toolMode = useAtomValue(toolModeAtom);
	const previewFullscreen = useAtomValue(previewFullscreenAtom);
	const previewModeRef = useRef(false);
	const previewHiddenRef = useRef(false);
	previewModeRef.current = toolMode === ToolMode.Preview;
	previewHiddenRef.current = previewModeRef.current && previewFullscreen;
	const lastPreviewSyncRef = useRef(0);

	const { hoverState, handleContainerMouseMove, handleContainerMouseLeave } =
		useHoverGuide(sliderWidthPx, isDraggingRef);

	const waveformPeaks = useMemo(() => {
		if (!audioBuffer) return null;
		const channel = audioBuffer.getChannelData(0);
		const qualityBins = performanceMode
			? 240
			: waveformQuality === "low"
				? 360
				: waveformQuality === "high"
					? 1600
					: 900;
		const bins = Math.max(
			160,
			Math.min(qualityBins, Math.floor(audioBuffer.duration * 40)),
		);
		const block = Math.max(1, Math.floor(channel.length / bins));
		const peaks = new Float32Array(bins);
		for (let index = 0; index < bins; index++) {
			const start = index * block;
			const end = Math.min(channel.length, start + block);
			let peak = 0;
			for (let sample = start; sample < end; sample += 3) {
				const value = Math.abs(channel[sample]);
				if (value > peak) peak = value;
			}
			peaks[index] = peak;
		}
		return peaks;
	}, [audioBuffer, performanceMode, waveformQuality]);

	useEffect(() => {
		spectrogramVisibleRef.current = spectrogramVisible;
		if (waveSurferRef.current) {
			waveSurferRef.current.toggleInteraction(!spectrogramVisible);
		}
	}, [spectrogramVisible]);

	const toggleMark = useCallback(
		(timeMs: number) => {
			setLyricLines((prev) => toggleMarkAt(prev, timeMs));
		},
		[setLyricLines],
	);

	const updateMark = useCallback(
		(timeMs: number, data: Partial<Mark>) => {
			setLyricLines((prev) => updateMarkAt(prev, timeMs, data));
		},
		[setLyricLines],
	);

	const seekPlayheadFromClientX = useCallback(
		(clientX: number) => {
			if (!wsContainerRef.current || currentDuration <= 0) return;
			const rect = wsContainerRef.current.getBoundingClientRect();
			if (rect.width <= 0) return;
			const progress = Math.max(
				0,
				Math.min(1, (clientX - rect.left) / rect.width),
			);
			const timeMs = progress * currentDuration;
			const timeS = timeMs / 1000;
			audioEngine.seekMusic(timeS);
			setCurrentTime(Math.round(timeMs));
			if (waveSurferRef.current) {
				waveSurferRef.current.setTime(timeS);
			}
		},
		[currentDuration, setCurrentTime],
	);

	const scrollSpectrogramFromClientX = useCallback(
		(clientX: number) => {
			if (!wsContainerRef.current || currentDuration <= 0) return;
			const rect = wsContainerRef.current.getBoundingClientRect();
			if (rect.width <= 0) return;
			const progress = Math.max(
				0,
				Math.min(1, (clientX - rect.left) / rect.width),
			);
			const timeS = progress * (currentDuration / 1000);
			const targetScroll = clampScroll(
				timeS * zoom - containerWidth / 2,
				zoom,
				currentDuration,
				containerWidth,
			);
			setScrollLeft(targetScroll);
		},
		[containerWidth, currentDuration, setScrollLeft, zoom],
	);

	const startSeekPlayheadDrag = useCallback(
		(initialClientX: number) => {
			seekPlayheadFromClientX(initialClientX);
			isDraggingRef.current = true;
			const onMouseMove = (e: MouseEvent) => {
				seekPlayheadFromClientX(e.clientX);
			};
			const onMouseUp = () => {
				isDraggingRef.current = false;
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
			};
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
		},
		[seekPlayheadFromClientX],
	);

	const startSpectrogramScrollDrag = useCallback(
		(initialClientX: number) => {
			scrollSpectrogramFromClientX(initialClientX);
			isDraggingRef.current = true;
			const onMouseMove = (e: MouseEvent) => {
				scrollSpectrogramFromClientX(e.clientX);
			};
			const preventContextMenu = (e: MouseEvent) => {
				e.preventDefault();
			};
			const onMouseUp = () => {
				isDraggingRef.current = false;
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
				setTimeout(() => {
					window.removeEventListener("contextmenu", preventContextMenu);
				}, 50);
			};
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
			window.addEventListener("contextmenu", preventContextMenu, {
				capture: true,
				once: true,
			});
		},
		[scrollSpectrogramFromClientX],
	);

	const handleAudioBarMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (!wsContainerRef.current || sliderWidthPx <= 0 || currentDuration <= 0)
				return;
			const rect = wsContainerRef.current.getBoundingClientRect();
			if (rect.width <= 0) return;
			const progress = Math.max(
				0,
				Math.min(1, (e.clientX - rect.left) / rect.width),
			);
			const timeMs = progress * currentDuration;

			if (e.altKey && e.button === 0) {
				e.preventDefault();
				e.stopPropagation();
				toggleMark(timeMs);
				return;
			}

			// Right click (button === 2): Move spectrogram area
			if (e.button === 2) {
				e.preventDefault();
				e.stopPropagation();
				startSpectrogramScrollDrag(e.clientX);
				return;
			}

			// Left click (button === 0): Move playhead
			if (e.button === 0) {
				e.preventDefault();
				e.stopPropagation();
				startSeekPlayheadDrag(e.clientX);
				return;
			}
		},
		[
			currentDuration,
			sliderWidthPx,
			startSeekPlayheadDrag,
			startSpectrogramScrollDrag,
			toggleMark,
		],
	);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
	}, []);

	// Draw a cheap static waveform independently of WaveSurfer. If WaveSurfer
	// cannot create or paint its canvas, this keeps the transport readable and
	// still seekable through the existing mouse handlers. It is drawn only when
	// the audio buffer, width, or palette changes, never during playback.
	useEffect(() => {
		const canvas = fallbackCanvasRef.current;
		const container = wsContainerRef.current;
		if (!canvas || !container || !waveformPeaks || sliderWidthPx <= 0) return;
		const height = container.clientHeight || 40;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.max(1, Math.floor(sliderWidthPx * dpr));
		canvas.height = Math.max(1, Math.floor(height * dpr));
		canvas.style.width = `${sliderWidthPx}px`;
		canvas.style.height = `${height}px`;
		const context = canvas.getContext("2d");
		if (!context) return;
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, sliderWidthPx, height);
		const styles = getComputedStyle(container);
		const color = usableCanvasColor(
			styles.getPropertyValue("--adv-waveform-color"),
			FALLBACK_WAVE_COLOR,
		);
		context.fillStyle = color;
		context.globalAlpha = 0.78;
		const middle = height / 2;
		const count = waveformPeaks.length;
		const barWidth = Math.max(1, sliderWidthPx / count);
		for (let index = 0; index < count; index++) {
			const amplitude = Math.max(0.02, waveformPeaks[index]) * (height * 0.44);
			context.fillRect(index * barWidth, middle - amplitude, barWidth, amplitude * 2);
		}
		context.globalAlpha = 0.5;
		context.fillRect(0, middle, sliderWidthPx, 1);
	}, [waveformPeaks, sliderWidthPx, isDarkTheme, advWaveformColor, performanceMode]);

	useEffect(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0) return;
		const unsubscribe = subscribePreviewClock((frame) => {
			const playhead = fallbackPlayheadRef.current;
			if (!playhead) return;
			const progress = Math.max(
				0,
				Math.min(1, frame.timeMs / currentDuration),
			);
			playhead.style.transform = `translate3d(${progress * sliderWidthPx}px, 0, 0)`;
		});
		return unsubscribe;
	}, [currentDuration, sliderWidthPx]);

	const destroyWaveSurfer = useCallback(() => {
		if (waveSurferRef.current) {
			waveSurferRef.current.destroy();
			waveSurferRef.current = null;
		}
	}, []);

	const createWaveSurfer = useCallback(() => {
		if (!wsContainerRef.current || !audioBuffer) {
			return null;
		}
		const measuredHeight = wsContainerRef.current.clientHeight;
		const waveHeight =
			measuredHeight > 0
				? measuredHeight
				: Number.parseInt(height, 10) || 42;
		const canvasStyles = getComputedStyle(wsContainerRef.current);
		const fontColor = usableCanvasColor(
			canvasStyles.getPropertyValue("--adv-waveform-progress"),
			FALLBACK_PROGRESS_COLOR,
		);
		const primaryFillColor = usableCanvasColor(
			canvasStyles.getPropertyValue("--adv-waveform-color"),
			FALLBACK_WAVE_COLOR,
		);

		// Reuse the peaks already computed for the fallback instead of making
		// WaveSurfer scan the entire channel a second time.
		const peaks = [waveformPeaks ?? audioBuffer.getChannelData(0)];
		const duration = audioBuffer.duration;

		const ws = WaveSurfer.create({
			container: wsContainerRef.current,
			height: waveHeight,
			hideScrollbar: true,
			waveColor: primaryFillColor,
			progressColor: fontColor,
			cursorColor: fontColor,
			dragToSeek: true,
			cursorWidth: 0,
			barHeight: 0.8,
			peaks: peaks,
			duration: duration,
			interact: !spectrogramVisibleRef.current,
		});
		ws.on("dragstart", () => {
			if (spectrogramVisibleRef.current) return;
			isDraggingRef.current = true;
		});
		ws.on("dragend", () => {
			if (spectrogramVisibleRef.current) return;
			isDraggingRef.current = false;
			const time = audioEngine.musicCurrentTime;
			setCurrentTime(Math.round(time * 1000));
			if (waveSurferRef.current) {
				waveSurferRef.current.setTime(time);
			}
		});
		ws.on("interaction", (newTime: number) => {
			if (spectrogramVisibleRef.current) return;
			setCurrentTime(Math.round(newTime * 1000));
			audioEngine.seekMusic(newTime);
		});
		waveSurferRef.current = ws;
		return ws;
	}, [audioBuffer, height, isDarkTheme, setCurrentTime, waveformPeaks]);

	// The colors are read from CSS variables, so these settings must retrigger
	// the read even though the callback does not reference them directly.
	// biome-ignore lint/correctness/useExhaustiveDependencies: CSS variables change with the theme atoms
	useEffect(() => {
		if (!waveSurferRef.current || !wsContainerRef.current) return;
		const raf = requestAnimationFrame(() => {
			if (!wsContainerRef.current || !waveSurferRef.current) return;
			const canvasStyles = getComputedStyle(wsContainerRef.current);
			const fontColor = usableCanvasColor(
				canvasStyles.getPropertyValue("--adv-waveform-progress"),
				FALLBACK_PROGRESS_COLOR,
			);
			const primaryFillColor = usableCanvasColor(
				canvasStyles.getPropertyValue("--adv-waveform-color"),
				FALLBACK_WAVE_COLOR,
			);

			if (fontColor && primaryFillColor) {
				try {
					waveSurferRef.current.setOptions({
						waveColor: primaryFillColor,
						progressColor: fontColor,
						cursorColor: fontColor,
					});
				} catch (e) {
					console.error("Failed to update WaveSurfer options", e);
				}
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [
		isDarkTheme,
		accentColor,
		useCustomAccent,
		customAccentColor,
		advWaveformColor,
		advWaveformProgress,
		activePresetId,
	]);

	useEffect(() => {
		const container = wsContainerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setSliderWidthPx(entries[0].contentRect.width);
			}
		});
		observer.observe(container);
		setSliderWidthPx(container.clientWidth);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (audioBuffer) {
			destroyWaveSurfer();
			setCurrentDuration((audioBuffer.duration * 1000) | 0);
			createWaveSurfer();
		}
	}, [audioBuffer, createWaveSurfer, destroyWaveSurfer, setCurrentDuration]);

	useEffect(() => {
		const handleMusicUnload = () => {
			destroyWaveSurfer();
			setCurrentDuration(0);
			setCurrentTime(0);
			setAudioPlaying(false);
		};

		let frameId: number | null = null;
		let isDestroyed = false;

		const syncClock = (force = false) => {
			if (isDraggingRef.current) return;
			// The audio bar is display:none in Preview fullscreen. Updating it there
			// is pure waste and used to keep redrawing the hidden waveform.
			if (previewHiddenRef.current) return;
			if (previewModeRef.current || toolMode === ToolMode.Preview) {
				// Preview has its own shared clock. Keep the global atom only as a
				// coarse fallback for shortcuts; never re-render React at 60 Hz.
				const now = performance.now();
				if (!force && now - lastPreviewSyncRef.current < 250) return;
				lastPreviewSyncRef.current = now;
				setCurrentTime(Math.round(audioEngine.musicCurrentTime * 1000));
				return;
			}
			const time = audioEngine.musicCurrentTime;
			setCurrentTime(Math.round(time * 1000));
			if (waveSurferRef.current) {
				waveSurferRef.current.setTime(time);
			}
		};

		const onFrame = () => {
			if (
				isDestroyed ||
				!audioEngine.musicPlaying ||
				previewModeRef.current ||
				toolMode === ToolMode.Preview ||
				previewHiddenRef.current
			) {
				frameId = null;
				return;
			}

			if (!isDraggingRef.current) {
				const currentTime = audioEngine.musicCurrentTime;
				setCurrentTime(Math.round(currentTime * 1000));
				if (waveSurferRef.current) {
					waveSurferRef.current.setTime(currentTime);
				}
			}
			frameId = requestAnimationFrame(onFrame);
		};

		const handlePlay = () => {
			syncClock(true);
			if (toolMode !== ToolMode.Preview && frameId === null) onFrame();
			setAudioPlaying(true);
		};
		const handlePause = () => {
			syncClock(true);
			setAudioPlaying(false);
		};
		const handleSeek = () => syncClock(true);
		const handleTimeUpdate = () => syncClock();
		const handlePlaybackRateChange = () => syncClock(true);

		const handleWindowMouseUp = () => {
			if (isDraggingRef.current) {
				isDraggingRef.current = false;
				syncClock(true);
			}
		};
		window.addEventListener("mouseup", handleWindowMouseUp);

		audioEngine.addEventListener("music-unload", handleMusicUnload);
		audioEngine.addEventListener("music-resume", handlePlay);
		audioEngine.addEventListener("music-pause", handlePause);
		audioEngine.addEventListener("music-seeked", handleSeek);
		audioEngine.addEventListener("music-timeupdate", handleTimeUpdate);
		audioEngine.addEventListener(
			"music-playback-rate-change",
			handlePlaybackRateChange,
		);

		// Start loop if already playing
		if (audioEngine.musicPlaying) {
			handlePlay();
		}

		return () => {
			isDestroyed = true;
			if (frameId !== null) cancelAnimationFrame(frameId);
			destroyWaveSurfer();
			window.removeEventListener("mouseup", handleWindowMouseUp);
			audioEngine.removeEventListener("music-unload", handleMusicUnload);
			audioEngine.removeEventListener("music-resume", handlePlay);
			audioEngine.removeEventListener("music-pause", handlePause);
			audioEngine.removeEventListener("music-seeked", handleSeek);
			audioEngine.removeEventListener("music-timeupdate", handleTimeUpdate);
			audioEngine.removeEventListener(
				"music-playback-rate-change",
				handlePlaybackRateChange,
			);
		};
	}, [
		destroyWaveSurfer,
		setCurrentDuration,
		setCurrentTime,
		setAudioPlaying,
		toolMode,
	]);

	const selectedRegions = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0) return [];

		const pixelsPerMs = sliderWidthPx / currentDuration;
		const regions: { id: string; left: number; width: number }[] = [];

		for (const line of lyricLines.lyricLines) {
			if (selectedLines.has(line.id)) {
				const left = line.startTime * pixelsPerMs;
				const width = (line.endTime - line.startTime) * pixelsPerMs;
				regions.push({ id: line.id, left, width });
			}
		}
		return regions;
	}, [lyricLines.lyricLines, selectedLines, currentDuration, sliderWidthPx]);

	const markers = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0 || !lyricLines.marks)
			return [];
		return lyricLines.marks.map((mark) => ({
			...mark,
			left: (mark.timeMs / currentDuration) * sliderWidthPx,
			timestamp: msToTimestamp(mark.timeMs),
		}));
	}, [lyricLines.marks, currentDuration, sliderWidthPx]);

	return (
		<Box
			style={{
				alignSelf: "center",
				width: "100%",
				height,
				padding: "0",
				backgroundColor: "transparent",
			}}
		>
			<section
				className={styles.waveformContainer}
				aria-label={t("audio.waveform", "Audio Waveform")}
				ref={wsContainerRef}
				style={{ width: "100%", height: "100%", overflow: "hidden" }}
				onMouseDown={handleAudioBarMouseDown}
				onContextMenu={handleContextMenu}
				onMouseMove={handleContainerMouseMove}
				onMouseLeave={handleContainerMouseLeave}
			>
				<canvas
					ref={fallbackCanvasRef}
					className={styles.fallbackWaveform}
					aria-hidden="true"
				/>
				<div
					ref={fallbackPlayheadRef}
					className={styles.fallbackPlayhead}
					aria-hidden="true"
				/>
				<InteractiveHoverOverlay
					spectrogramVisible={spectrogramVisible}
					onMouseDown={handleAudioBarMouseDown}
					title={
						spectrogramVisible
							? t(
									"audio.spectrogramBarHint",
									"Left click to seek playhead. Right click to move spectrogram area.",
								)
							: undefined
					}
					hoverState={hoverState}
				/>

				{selectedRegions.map((region) => (
					<div
						key={region.id}
						className={styles.selectedLyricRegion}
						style={{
							left: `${region.left}px`,
							width: `${region.width}px`,
						}}
					/>
				))}

				<WaveformMarkers
					markers={markers}
					updateMark={updateMark}
					toggleMark={toggleMark}
				/>

				<AudioRegion
					sliderWidthPx={sliderWidthPx}
					containerRef={wsContainerRef}
					isDraggingRef={isDraggingRef}
				/>
			</section>
		</Box>
	);
});
