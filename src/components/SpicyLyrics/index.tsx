/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */

import { MusicNote224Regular } from "@fluentui/react-icons";
import classNames from "classnames";
import { useAtomValue, useSetAtom } from "jotai";
import {
	type CSSProperties,
	memo,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { PreviewProgressBar } from "$/components/PreviewProgressBar";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioCoverArtAtom,
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
} from "$/modules/audio/states";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import {
	backgroundModeAtom,
	customAccentColorAtom,
	performanceModeAtom,
	useCustomAccentAtom,
} from "$/modules/settings/states";
import {
	bgFollowsDuetAtom,
	previewFrameRateCapAtom,
	previewQualityAtom,
	previewShowAlbumArtworkAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyBackgroundModeAtom,
	spicyForceLineSyncedAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import { lyricLinesAtom, projectIdentityAtom } from "$/states/main";
import {
	type PreviewFrame,
	requestPreviewFrame,
	subscribePreviewClock,
} from "./clock";
import styles from "./index.module.css";
import { progressAt, stateAt } from "./math";
import {
	buildSpicyLines,
	groupSpicyTokens,
	isRtl,
	type SpicyLine,
	type SpicyToken,
} from "./model";

type KawarpInstance = {
	dispose(): void;
	loadImage(url: string): Promise<void>;
	loadImageElement(source: TexImageSource): void;
	start(): void;
	setOptions(options: {
		animationSpeed?: number;
		transitionDuration?: number;
	}): void;
};
type CoverPalette = { base: string; highlight: string };

const keyFor = (line: SpicyLine, word: SpicyToken, index: number) =>
	`${line.id}:${word.id}:${index}`;

type SlowFrameReport = {
	frameMs: number;
	jsMs: number;
	time: number;
	line: string | null;
	lineStatesMs: number;
	wordsMs: number;
	scrollMs: number;
	heapDeltaMb: number | null;
	longTasks: Array<{ type: string; duration: number; start: number }>;
};

const MAX_SLOW_FRAMES = 50;

async function copyText(text: string) {
	try {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Fall through to the WebView2-compatible copy path.
	}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const copied = document.execCommand("copy");
		area.remove();
		return copied;
	} catch {
		return false;
	}
}

const BLURRED_ARTWORK_CACHE = new Map<string, string>();

function useBlurredArtwork(source: string | null, enabled: boolean) {
	const [blurred, setBlurred] = useState<string | null>(null);
	useEffect(() => {
		if (!source || !enabled) {
			setBlurred(null);
			return;
		}
		const cached = BLURRED_ARTWORK_CACHE.get(source);
		if (cached) {
			setBlurred(cached);
			return;
		}
		let cancelled = false;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.decoding = "async";
		image.src = source;
		void image
			.decode()
			.then(() => {
				if (cancelled) return;
				const size = 112;
				const canvas = document.createElement("canvas");
				canvas.width = size;
				canvas.height = size;
				const context = canvas.getContext("2d");
				if (!context) return;
				const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
				const width = image.naturalWidth * scale;
				const height = image.naturalHeight * scale;
				context.filter = "blur(11px) brightness(0.5) saturate(1.25)";
				context.drawImage(
					image,
					(size - width) / 2,
					(size - height) / 2,
					width,
					height,
				);
				context.filter = "none";
				context.fillStyle = "rgba(7, 8, 12, 0.42)";
				context.fillRect(0, 0, size, size);
				const result = canvas.toDataURL("image/jpeg", 0.72);
				BLURRED_ARTWORK_CACHE.set(source, result);
				if (!cancelled) setBlurred(result);
			})
			.catch(() => {
				if (!cancelled) setBlurred(null);
			});
		return () => {
			cancelled = true;
		};
	}, [source, enabled]);
	return blurred;
}

const colorToHex = (red: number, green: number, blue: number) =>
	`#${[red, green, blue]
		.map((value) => Math.round(value).toString(16).padStart(2, "0"))
		.join("")}`;

function useCoverPalette(imageSource: string | null) {
	const [palette, setPalette] = useState<CoverPalette | null>(null);
	useEffect(() => {
		if (!imageSource) {
			setPalette(null);
			return;
		}
		let cancelled = false;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.src = imageSource;
		void image
			.decode()
			.then(() => {
				const canvas = document.createElement("canvas");
				canvas.width = 32;
				canvas.height = 32;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) return;
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				const { data } = context.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				);
				const base = { red: 0, green: 0, blue: 0, weight: 0 };
				let highlight = { red: 0, green: 0, blue: 0, saturation: -1 };
				for (let index = 0; index < data.length; index += 4) {
					const red = data[index];
					const green = data[index + 1];
					const blue = data[index + 2];
					const alpha = data[index + 3] / 255;
					const max = Math.max(red, green, blue);
					const min = Math.min(red, green, blue);
					const saturation = max === 0 ? 0 : (max - min) / max;
					const weight = alpha * (0.35 + saturation * 0.65);
					base.red += red * weight;
					base.green += green * weight;
					base.blue += blue * weight;
					base.weight += weight;
					if (saturation > highlight.saturation && max > 38 && max < 235)
						highlight = { red, green, blue, saturation };
				}
				if (!base.weight || cancelled) return;
				const baseColor = colorToHex(
					base.red / base.weight,
					base.green / base.weight,
					base.blue / base.weight,
				);
				setPalette({
					base: baseColor,
					highlight:
						highlight.saturation >= 0
							? colorToHex(highlight.red, highlight.green, highlight.blue)
							: baseColor,
				});
			})
			.catch(() => {
				if (!cancelled) setPalette(null);
			});
		return () => {
			cancelled = true;
		};
	}, [imageSource]);
	return palette;
}

async function loadKawarpSafeImage(
	instance: KawarpInstance,
	src: string,
): Promise<void> {
	if (src.startsWith("blob:") || src.startsWith("data:")) {
		try {
			const res = await fetch(src);
			const blob = await res.blob();
			if (typeof createImageBitmap === "function") {
				const bitmap = await createImageBitmap(blob);
				if (bitmap.width > 0 && bitmap.height > 0) {
					instance.loadImageElement(bitmap);
					bitmap.close();
					return;
				}
			}
		} catch {
			// Fallback to Image element
		}
	}

	await new Promise<void>((resolve, reject) => {
		const img = new Image();
		if (!src.startsWith("blob:") && !src.startsWith("data:")) {
			img.crossOrigin = "anonymous";
		}
		img.onload = async () => {
			try {
				if ("decode" in img) {
					await img.decode();
				}
				if (img.naturalWidth > 0 && img.naturalHeight > 0) {
					instance.loadImageElement(img);
				}
				resolve();
			} catch (err) {
				reject(err);
			}
		};
		img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
		img.src = src;
	});
}

function useKawarpBackground(
	container: RefObject<HTMLDivElement | null>,
	image: string | null,
	mode: "animated" | "color" | "static",
	animate: boolean,
) {
	useEffect(() => {
		if (!animate || mode !== "animated" || !image || !container.current) return;
		let disposed = false;
		let instance: KawarpInstance | null = null;
		let frame = 0;
		const canvas = document.createElement("canvas");
		canvas.className = styles.backgroundCanvas;
		container.current.replaceChildren(canvas);
		void import("@kawarp/core")
			.then(async ({ default: Kawarp }) => {
				if (disposed) return;
				instance = new Kawarp(canvas, {
					warpIntensity: 1,
					blurPasses: 8,
					animationSpeed: 0.1,
					saturation: 1.5,
					dithering: 0.008,
					tintIntensity: 0,
					scale: 1,
					transitionDuration: 500,
				}) as KawarpInstance;
				try {
					await loadKawarpSafeImage(instance, image);
				} catch {
					await instance.loadImage(image).catch(() => {});
				}
				if (disposed) return;
				instance.start();
				const bins = new Uint8Array(audioEngine.analyserNode.frequencyBinCount);
				const animate = () => {
					audioEngine.analyserNode.getByteFrequencyData(bins);
					const energy =
						bins.reduce((sum, value) => sum + value, 0) / (bins.length * 255);
					instance?.setOptions({ animationSpeed: 0.1 + energy * 0.35 });
					frame = requestAnimationFrame(animate);
				};
				frame = requestAnimationFrame(animate);
			})
			.catch(() => container.current?.replaceChildren());
		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			instance?.dispose();
		};
	}, [container, image, mode, animate]);
}

export const SpicyLyrics = memo(
	({ isPanel = false }: { isPanel?: boolean }) => {
		const lyrics = useAtomValue(lyricLinesAtom);
		const projectIdentity = useAtomValue(projectIdentityAtom);
		const simple = useAtomValue(spicySimpleLyricsModeAtom);
		const forceLineSynced = useAtomValue(spicyForceLineSyncedAtom);
		const romanized = useAtomValue(showRomanLinesAtom);
		const showTranslation = useAtomValue(showTranslationLinesAtom);
		const showFps = useAtomValue(showFpsCounterAtom);
		const backgroundMode = useAtomValue(spicyBackgroundModeAtom);
		const embeddedCoverArt = useAtomValue(audioCoverArtAtom);
		const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
		const useAccent = useAtomValue(useCustomAccentAtom);
		const accent = useAtomValue(customAccentColorAtom);
		const bgFollowsDuet = useAtomValue(bgFollowsDuetAtom);
		const setCurrentTime = useSetAtom(currentTimeAtom);
		const currentDuration = useAtomValue(currentDurationAtom);
		const isPlaying = useAtomValue(audioPlayingAtom);
		const previewQuality = useAtomValue(previewQualityAtom);
		const previewFrameRateCap = useAtomValue(previewFrameRateCapAtom);
		const performanceMode = useAtomValue(performanceModeAtom);
		const effectiveQuality = performanceMode ? "low" : previewQuality;
		const renderCountRef = useRef(0);
		renderCountRef.current++;

		const showArtwork = useAtomValue(previewShowAlbumArtworkAtom);

		const totalDuration = useMemo(() => {
			if (currentDuration > 0) return currentDuration;
			if (lyrics.lyricLines.length > 0) {
				return Math.max(...lyrics.lyricLines.map((l) => l.endTime || 0));
			}
			return 0;
		}, [currentDuration, lyrics.lyricLines]);

		const seek = (time: number) => {
			setCurrentTime(time);
			audioEngine.resumeOrSeekMusic(time / 1000);
		};

		const handleTogglePlay = (e: React.MouseEvent) => {
			e.stopPropagation();
			if (audioEngine.musicPlaying) {
				audioEngine.pauseMusic();
			} else {
				audioEngine.resumeOrSeekMusic();
			}
		};

		const lines = useMemo(
			() =>
				buildSpicyLines(
					lyrics.lyricLines,
					simple,
					romanized,
					forceLineSynced,
					bgFollowsDuet,
				),
			[lyrics.lyricLines, simple, romanized, forceLineSynced, bgFollowsDuet],
		);
		const hasDuetLines = useMemo(
			() => lines.some((line) => !line.isDotLine && line.isDuet),
			[lines],
		);
		// Actual song artwork: only embedded in audio or specified in TTML cover_art metadata
		const coverArtImage = useMemo(
			() =>
				lyrics.metadata
					.find((entry) => entry.key.toLowerCase() === "cover_art")
					?.value.find((value) => value.trim().length > 0) ?? null,
			[lyrics.metadata],
		);
		const songCredits = useMemo(() => {
			const findMeta = (keys: string[]) => {
				for (const key of keys) {
					const entry = lyrics.metadata.find(
						(m) => m.key.toLowerCase() === key.toLowerCase(),
					);
					if (entry && entry.value.length > 0) {
						const joined = entry.value.filter((v) => v.trim()).join(", ");
						if (joined) return joined;
					}
				}
				return null;
			};

			const writers = findMeta([
				"writers",
				"writer",
				"lyricist",
				"lyricists",
				"author",
				"composer",
			]);
			const provider = findMeta(["provider", "source"]);
			const community = findMeta([
				"transcriber",
				"synced_by",
				"sync_by",
				"contributor",
				"credit",
			]);

			if (!writers && !provider && !community) return null;
			return { writers, provider, community };
		}, [lyrics.metadata]);
		const appBackgroundMode = useAtomValue(backgroundModeAtom);
		const songCoverArt = embeddedCoverArt || coverArtImage || null;
		const rawBackgroundImage =
			songCoverArt ||
			(appBackgroundMode === "image" ? customBackgroundImage : null);
		const blurredArtwork = useBlurredArtwork(songCoverArt, showArtwork);
		const displayBackgroundImage = showArtwork && songCoverArt
			? blurredArtwork
			: appBackgroundMode === "image"
				? customBackgroundImage
				: null;
		// The artwork background is deliberately static. Kawarp is retained only
		// for a custom background, never for a cover image, so starting playback
		// cannot swap a heavy WebGL layer in or out.
		const animateBackground =
			!isPlaying &&
			effectiveQuality === "high" &&
			!performanceMode &&
			!songCoverArt &&
			!showArtwork;
		const coverPalette = useCoverPalette(rawBackgroundImage);
		const viewportRef = useRef<HTMLDivElement>(null);
		const backgroundRef = useRef<HTMLDivElement>(null);
		const lineNodes = useRef(new Map<string, HTMLDivElement>());
		const wordNodes = useRef(new Map<string, HTMLElement>());
		const trackRef = useRef<HTMLDivElement>(null);
		const lineStateRef = useRef(new Map<string, string>());
		const lineOffsetsRef = useRef<Array<{ top: number; height: number }>>([]);
		const scrollOffsetRef = useRef(0);
		const scrollTargetRef = useRef(0);
		const scrollPauseUntil = useRef(0);
		const lastLine = useRef<string | null>(null);
		const fpsLabelRef = useRef<HTMLDivElement>(null);
		const slowFramesRef = useRef<SlowFrameReport[]>([]);
		const longTasksRef = useRef<
			Array<{ type: string; duration: number; start: number }>
		>([]);
		const [reportCopied, setReportCopied] = useState(false);
		const firstFrameRef = useRef(true);
		useKawarpBackground(
			backgroundRef,
			rawBackgroundImage,
			backgroundMode,
			animateBackground,
		);

		useEffect(() => {
			const viewport = viewportRef.current;
			const track = trackRef.current;
			if (!viewport || !track) return;

			const reducedMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			let disposed = false;
			let lastRenderedTime = 0;
			let previousRenderedTime = 0;
			let lastFrameAt = performance.now();
			let lastDebugAt = lastFrameAt;
			let debugFrames = 0;
			let debugFrameMs = 0;
			let debugWorstMs = 0;
			let debugRenderBase = renderCountRef.current;
			let lastHeapUsed = 0;
			let activeIndex = -1;
			let forceState = true;
			let lastCapAt = 0;
			let viewportHeight = 0;
			let maxScroll = 0;
			const slowFrames = slowFramesRef.current;
			const longTasks = longTasksRef.current;
			slowFrames.length = 0;
			longTasks.length = 0;
			const performanceObservers: PerformanceObserver[] = [];
			if (showFps && typeof PerformanceObserver !== "undefined") {
				const onLongEntry = (list: PerformanceObserverEntryList) => {
					for (const entry of list.getEntries()) {
						if (entry.duration < 20) continue;
						longTasks.push({
							type: entry.entryType,
							duration: Math.round(entry.duration * 10) / 10,
							start: Math.round(entry.startTime),
						});
						if (longTasks.length > 60) longTasks.shift();
					}
				};
				// Observe separately: an unsupported entry type must not disable
				// the other one.
				for (const entryType of ["longtask", "long-animation-frame"]) {
					try {
						const observer = new PerformanceObserver(onLongEntry);
						observer.observe({ entryTypes: [entryType] });
						performanceObservers.push(observer);
					} catch {
						// WebView2 may expose PerformanceObserver without every type.
					}
				}
			}
			const capMs =
				typeof previewFrameRateCap === "number"
					? 1000 / previewFrameRateCap
					: 0;

			lineStateRef.current.clear();
			lineOffsetsRef.current = [];
			lastLine.current = null;
			firstFrameRef.current = true;
			scrollOffsetRef.current = 0;
			scrollTargetRef.current = 0;
			track.style.transform = "translate3d(0, 0, 0)";

			const clampScroll = (value: number) =>
				Math.max(0, Math.min(maxScroll, value));

			const applyScroll = () => {
				const dpr = window.devicePixelRatio || 1;
				const rounded = Math.round(scrollOffsetRef.current * dpr) / dpr;
				track.style.transform = `translate3d(0, ${-rounded}px, 0)`;
			};

			const measure = () => {
				if (disposed) return;
				viewportHeight = viewport.clientHeight;
				maxScroll = Math.max(0, track.scrollHeight - viewportHeight);
				lineOffsetsRef.current = lines.map((line) => {
					const node = lineNodes.current.get(line.id);
					return node
						? { top: node.offsetTop, height: node.offsetHeight }
						: { top: 0, height: 0 };
				});
				scrollOffsetRef.current = clampScroll(scrollOffsetRef.current);
				scrollTargetRef.current = clampScroll(scrollTargetRef.current);
				applyScroll();
			};

			const setActiveScroll = (index: number) => {
				const info = lineOffsetsRef.current[index];
				if (!info) return;
				scrollTargetRef.current = clampScroll(
					info.top + info.height / 2 - viewportHeight / 2 + 30,
				);
				if (firstFrameRef.current) {
					scrollOffsetRef.current = scrollTargetRef.current;
					firstFrameRef.current = false;
					applyScroll();
				}
			};

			const findActiveIndex = (time: number) => {
				if (!lines.length) return -1;
				if (activeIndex < 0) activeIndex = 0;
				if (activeIndex >= lines.length) activeIndex = lines.length - 1;
				while (activeIndex > 0 && lines[activeIndex].startTime > time)
					activeIndex--;
				while (
					activeIndex + 1 < lines.length &&
					lines[activeIndex + 1].startTime <= time
				)
					activeIndex++;
				const from = Math.max(0, activeIndex - 8);
				const to = Math.min(lines.length - 1, activeIndex + 8);
				let found = -1;
				for (let i = from; i <= to; i++) {
					if (stateAt(time, lines[i].startTime, lines[i].endTime) === "active")
						found = i;
				}
				return found;
			};

			const updateLineStates = (
				time: number,
				force: boolean,
				focusIndex: number,
			) => {
				// A normal frame only needs the lines around the playhead. A seek
				// (or the first frame after a mode/settings change) still refreshes
				// every line so old highlights cannot survive behind the viewport.
				const from = force ? 0 : Math.max(0, focusIndex - 2);
				const to = force
					? lines.length - 1
					: Math.min(lines.length - 1, focusIndex + 2);
				for (let i = from; i <= to; i++) {
					const line = lines[i];
					const status = stateAt(time, line.startTime, line.endTime);
					const previous = lineStateRef.current.get(line.id);
					if (!force && previous === status) continue;
					lineStateRef.current.set(line.id, status);
					const node = lineNodes.current.get(line.id);
					if (!node) continue;
					node.dataset.state = status;
					if (line.isDotLine) {
						node.dataset.prehidden = String(
							status === "not-sung" || time > line.endTime - 500,
						);
					}
					if (line.isLineSynced) {
						node.style.setProperty(
							"--line-gradient-position",
							status === "sung"
								? "100%"
								: status === "active"
									? `${progressAt(time, line.startTime, line.endTime) * 100}%`
									: "-20%",
						);
					}
				}
			};

			const updateActiveWords = (
				line: SpicyLine,
				time: number,
				force: boolean,
			) => {
				const perLetter = effectiveQuality === "high" && !simple;
				let focusWord = -1;
				for (let wi = 0; wi < line.words.length; wi++) {
					const word = line.words[wi];
					if (word.endTime > time) {
						focusWord = wi;
						break;
					}
				}
				if (focusWord < 0) focusWord = line.words.length - 1;
				if (focusWord < 0) return;
				// Keep the previous word in sync so it lands on 100% when focus
				// moves, but never touch the next word: it is still not-sung and is
				// covered by its static CSS state.
				const from = force ? 0 : Math.max(0, focusWord - 1);
				const to = force
					? line.words.length - 1
					: Math.min(line.words.length - 1, focusWord);
				for (let wi = from; wi <= to; wi++) {
					const word = line.words[wi];
					if (!word.endTime || word.endTime <= word.startTime) continue;
					const rootKey = keyFor(line, word, wi);
					const root = wordNodes.current.get(rootKey);
					const wordState = stateAt(time, word.startTime, word.endTime);
					const wordProgress =
						wordState === "active"
							? progressAt(time, word.startTime, word.endTime)
							: wordState === "sung"
								? 1
								: 0;
					const rootPosition = simple
						? -50 + 150 * wordProgress
						: -20 + 120 * wordProgress;
					if (root)
						root.style.setProperty("--gradient-position", `${rootPosition}%`);

					if (!word.letters) continue;
					const duration =
						(word.endTime - word.startTime) / word.letters.length;
					for (let index = 0; index < word.letters.length; index++) {
						const start = word.startTime + index * duration;
						const end = start + duration;
						const letter = wordNodes.current.get(`${rootKey}:${start}`);
						if (!letter) continue;
						let position = rootPosition;
						if (perLetter) {
							const letterState = stateAt(time, start, end);
							const letterProgress =
								letterState === "active"
									? progressAt(time, start, end)
									: letterState === "sung"
										? 1
										: 0;
							position = simple
								? -50 + 150 * letterProgress
								: -20 + 120 * letterProgress;
						}
						letter.style.setProperty("--gradient-position", `${position}%`);
					}
				}
			};

			const updateDebug = (
				frame: PreviewFrame,
				time: number,
				frameMs: number,
				jsMs: number,
				line: string | null,
				lineStatesMs: number,
				wordsMs: number,
				scrollMs: number,
			) => {
				if (!showFps) return;
				lastFrameAt = frame.now;
				debugFrames++;
				debugFrameMs += frameMs;
				if (frameMs > debugWorstMs) debugWorstMs = frameMs;
				if (frameMs > 33) {
					const memory = (
						performance as Performance & {
							memory?: { usedJSHeapSize: number };
						}
					).memory;
					const heapUsed = memory?.usedJSHeapSize ?? 0;
					const heapDeltaMb =
						memory && lastHeapUsed > 0
							? Math.round(((heapUsed - lastHeapUsed) / 1048576) * 10) / 10
							: null;
					lastHeapUsed = heapUsed;
					slowFrames.push({
						frameMs: Math.round(frameMs * 10) / 10,
						jsMs: Math.round(jsMs * 10) / 10,
						time: Math.round(time),
						line,
						lineStatesMs: Math.round(lineStatesMs * 10) / 10,
						wordsMs: Math.round(wordsMs * 10) / 10,
						scrollMs: Math.round(scrollMs * 10) / 10,
						heapDeltaMb,
						longTasks: longTasks.slice(-4),
					});
					if (slowFrames.length > MAX_SLOW_FRAMES) slowFrames.shift();
				}
				const elapsed = frame.now - lastDebugAt;
				if (elapsed < 500) return;
				const fps = (debugFrames * 1000) / elapsed;
				const avg = debugFrameMs / Math.max(1, debugFrames);
				const renders =
					((renderCountRef.current - debugRenderBase) * 1000) / elapsed;
				const label = fpsLabelRef.current;
				if (label) {
					label.textContent = `FPS ${fps.toFixed(0)} · avg ${avg.toFixed(1)} ms · worst ${debugWorstMs.toFixed(1)} ms · slow ${slowFrames.length} · React ${renders.toFixed(1)}/s · t ${(time / 1000).toFixed(2)}s`;
				}
				debugFrames = 0;
				debugFrameMs = 0;
				debugWorstMs = 0;
				debugRenderBase = renderCountRef.current;
				lastDebugAt = frame.now;
			};

			const renderFrame = (frame: PreviewFrame, force = false) => {
				if (disposed) return;
				const frameStart = showFps ? performance.now() : 0;
				let sectionAt = frameStart;
				previousRenderedTime = lastRenderedTime;
				lastRenderedTime =
					frame.timeMs + (frame.playing ? 100 : 0) - (simple ? 33.5 : 0);
				const seeked = Math.abs(lastRenderedTime - previousRenderedTime) > 250;
				const nextActive = findActiveIndex(lastRenderedTime);
				updateLineStates(
					lastRenderedTime,
					force || forceState || seeked,
					activeIndex,
				);
				forceState = false;
				const lineStatesMs = showFps ? performance.now() - sectionAt : 0;
				if (showFps) sectionAt = performance.now();
				let wordsMs = 0;

				if (
					scrollPauseUntil.current > 0 &&
					frame.now > scrollPauseUntil.current
				) {
					scrollPauseUntil.current = 0;
					lastLine.current = null;
				}

				if (nextActive >= 0) {
					const line = lines[nextActive];
					if (line.isLineSynced && !line.isDotLine) {
						const node = lineNodes.current.get(line.id);
						if (node)
							node.style.setProperty(
								"--line-gradient-position",
								`${simple ? 100 : progressAt(lastRenderedTime, line.startTime, line.endTime) * 100}%`,
							);
					} else if (!line.isDotLine) {
						updateActiveWords(line, lastRenderedTime, force || seeked);
					}

					if (lastLine.current !== line.id) {
						lastLine.current = line.id;
						setActiveScroll(nextActive);
					}
				} else if (activeIndex >= 0) {
					// Between lines the previous line has ended; settle any word that
					// was still mid-gradient instead of leaving it partly highlighted.
					const line = lines[activeIndex];
					if (line && !line.isDotLine && !line.isLineSynced)
						updateActiveWords(line, lastRenderedTime, seeked);
				}
				wordsMs = showFps ? performance.now() - sectionAt : 0;
				if (showFps) sectionAt = performance.now();

				if (!frame.playing) {
					scrollOffsetRef.current = scrollTargetRef.current;
					applyScroll();
				} else if (scrollPauseUntil.current === 0) {
					const delta = scrollTargetRef.current - scrollOffsetRef.current;
					if (Math.abs(delta) > 0.05) {
						const factor = reducedMotion ? 1 : 1 - Math.exp(-14 * frame.dt);
						scrollOffsetRef.current += delta * factor;
						if (
							Math.abs(scrollTargetRef.current - scrollOffsetRef.current) < 0.05
						)
							scrollOffsetRef.current = scrollTargetRef.current;
						applyScroll();
					}
				}

				const scrollMs = showFps ? performance.now() - sectionAt : 0;
				if (showFps) {
					const rawMs = Math.min(100, Math.max(0, frame.now - lastFrameAt));
					updateDebug(
						frame,
						lastRenderedTime,
						rawMs,
						performance.now() - frameStart,
						nextActive >= 0
							? (lines[nextActive].text || lines[nextActive].id).slice(0, 120)
							: null,
						lineStatesMs,
						wordsMs,
						scrollMs,
					);
				} else {
					lastFrameAt = frame.now;
				}
			};

			const onWheel = (event: WheelEvent) => {
				event.preventDefault();
				scrollPauseUntil.current = performance.now() + 900;
				scrollTargetRef.current = clampScroll(
					scrollOffsetRef.current + event.deltaY,
				);
				scrollOffsetRef.current = scrollTargetRef.current;
				applyScroll();
			};
			const onResize = () => {
				measure();
				lastLine.current = null;
				forceState = true;
				requestPreviewFrame();
			};

			viewport.addEventListener("wheel", onWheel, { passive: false });
			window.addEventListener("resize", onResize);
			const observer = new ResizeObserver(onResize);
			observer.observe(viewport);
			// Do not observe the track. State changes (especially dot lines) can
			// resize it during playback; measuring then forces a synchronous layout
			// on every line change. Line data and viewport changes are enough.

			measure();
			const unsubscribe = subscribePreviewClock((frame) => {
				if (disposed) return;
				if (capMs > 0 && frame.playing && frame.now - lastCapAt < capMs - 1)
					return;
				lastCapAt = frame.now;
				renderFrame(frame);
			});

			return () => {
				disposed = true;
				unsubscribe();
				viewport.removeEventListener("wheel", onWheel);
				window.removeEventListener("resize", onResize);
				observer.disconnect();
				for (const performanceObserver of performanceObservers)
					performanceObserver.disconnect();
			};
		}, [lines, simple, previewFrameRateCap, effectiveQuality, showFps]);
		const renderToken = (
			line: SpicyLine,
			word: SpicyToken,
			wordIndex: number,
			wordBoundary: boolean,
		) => {
			const key = keyFor(line, word, wordIndex);
			const letters = word.letters;
			const isWordTimed =
				word.endTime > word.startTime &&
				(word.startTime > 0 || word.endTime > 0);
			const className = letters ? styles.letterGroup : styles.word;
			return (
				<span
					key={key}
					ref={(node) => {
						if (node) wordNodes.current.set(key, node);
						else wordNodes.current.delete(key);
					}}
					className={classNames(
						className,
						word.isPartOfWord && styles.partOfWord,
						wordBoundary && styles.wordBoundary,
						word.allowInternalWrap && styles.breakableToken,
						!isWordTimed && styles.tokenUnsynced,
					)}
					dir={isRtl(word.text) ? "rtl" : undefined}
					onClick={
						!isWordTimed
							? (e) => {
									e.stopPropagation();
								}
							: undefined
					}
				>
					{letters
						? letters
								.map((letter, index) => ({
									letter,
									start:
										word.startTime +
										index * ((word.endTime - word.startTime) / letters.length),
								}))
								.map(({ letter, start }) => (
									<span
										key={`${key}:${start}`}
										ref={(node) => {
											if (node) wordNodes.current.set(`${key}:${start}`, node);
											else wordNodes.current.delete(`${key}:${start}`);
										}}
										className={styles.letter}
									>
										{letter}
									</span>
								))
						: word.text}
				</span>
			);
		};
		const lyricsContent = (
			<div
				ref={viewportRef}
				className={classNames(
					styles.viewport,
					hasDuetLines && styles.hasDuetLines,
				)}
			>
				<div ref={trackRef} className={styles.track}>
					{lines.map((line) => {
						const isLineTimed =
							line.isDotLine ||
							line.startTime > 0 ||
							line.endTime > 0 ||
							Boolean(
								line.words &&
									line.words.some(
										(w) =>
											w.endTime > w.startTime &&
											(w.startTime > 0 || w.endTime > 0),
									),
							);
						return (
							<div
								key={line.id}
								ref={(node) => {
									if (node) lineNodes.current.set(line.id, node);
									else lineNodes.current.delete(line.id);
								}}
								className={classNames(
									styles.line,
									line.isDotLine && styles.dotLine,
									line.isLineSynced && styles.lineSynced,
									line.isRtl && styles.rtl,
									line.isBackground && styles.backgroundLine,
									line.isDuet && styles.duet,
									!isLineTimed && styles.lineUnsynced,
								)}
								dir={line.isRtl ? "rtl" : undefined}
								onClick={() => {
									if (!isLineTimed) return;
									seek(line.startTime);
								}}
							>
								{line.isDotLine ? (
									<div className={styles.dotGroup}>
										{line.words.map((word, wi) => {
											const key = keyFor(line, word, wi);
											return (
												<span
													key={key}
													ref={(node) => {
														if (node) wordNodes.current.set(key, node);
														else wordNodes.current.delete(key);
													}}
													className={styles.dot}
												>
													{word.text}
												</span>
											);
										})}
									</div>
								) : line.isLineSynced ? (
									line.text
								) : (
									groupSpicyTokens(line.words).map((group) => {
										const first = group.items[0];
										if (group.items.length === 1)
											return renderToken(
												line,
												first.token,
												first.wordIndex,
												group.hasTrailingSpace,
											);
										return (
											<span
												key={`group:${keyFor(line, first.token, first.wordIndex)}`}
												className={classNames(
													styles.wordGroup,
													group.hasTrailingSpace && styles.wordBoundary,
												)}
											>
												{group.items.map(({ token, wordIndex }) =>
													renderToken(line, token, wordIndex, false),
												)}
											</span>
										);
									})
								)}
								{showTranslation && !line.isDotLine && line.translation ? (
									<span className={styles.translation}>{line.translation}</span>
								) : null}
							</div>
						);
					})}
					{songCredits && (
						<div className={styles.songCredits}>
							{songCredits.writers && (
								<div className={styles.credits}>
									<span className={styles.creditsLabel}>Written by</span>{" "}
									<span className={styles.creditsValue}>
										{songCredits.writers}
									</span>
								</div>
							)}
							{songCredits.provider && (
								<div className={styles.lyricsProvider}>
									<span className={styles.creditsLabel}>Provided by</span>{" "}
									<span className={styles.creditsValue}>
										{songCredits.provider}
									</span>
								</div>
							)}
							{songCredits.community && (
								<div className={styles.songInfo}>
									<div className={styles.maker}>
										<span className={styles.creditsLabel}>Synced by</span>{" "}
										<span className={styles.creditsValue}>
											{songCredits.community}
										</span>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);

		return (
			<div
				className={classNames(styles.root, simple && styles.simple)}
				data-quality={effectiveQuality}
				data-playing={isPlaying ? "true" : "false"}
				style={
					{
						"--spicy-accent":
							useAccent && accent ? accent : "var(--accent-9, #e5484d)",
						"--spicy-cover-base": coverPalette?.base,
						"--spicy-cover-highlight": coverPalette?.highlight,
					} as CSSProperties
				}
			>
				<div
					ref={backgroundRef}
					className={classNames(
						styles.background,
						backgroundMode === "animated" &&
							animateBackground &&
							styles.animatedBackground,
						backgroundMode === "animated" &&
							!animateBackground &&
							styles.pausedBackground,
					)}
					style={
						backgroundMode === "animated" && !animateBackground
							? {
									backgroundImage: displayBackgroundImage
										? `url("${displayBackgroundImage}")`
										: undefined,
								}
							: undefined
					}
				/>
				{backgroundMode === "color" ? (
					<div className={styles.colorBackground} />
				) : null}
				{backgroundMode === "static" && displayBackgroundImage ? (
					<div
						className={styles.staticBackground}
						style={{ backgroundImage: `url("${displayBackgroundImage}")` }}
					/>
				) : null}
				{backgroundMode === "static" && !displayBackgroundImage ? (
					<div className={styles.staticFallback} />
				) : null}
				<div className={styles.overlay} />
				{showFps ? (
					<div className={styles.fpsPanel}>
						<div ref={fpsLabelRef} className={styles.fpsCounter}>
							FPS: 0
						</div>
						<button
							type="button"
							className={styles.fpsCopy}
							onClick={() => {
								const frames = slowFramesRef.current;
								const report = frames.map((frame) => JSON.stringify(frame)).join("\n");
								const text = `TTML Tool slow frames (${frames.length})\nLong tasks: ${longTasksRef.current.map((task) => `${task.type} ${task.duration}ms`).join(", ") || "none"}\n${report || "no frames over 33ms"}`;
								void copyText(text).then(setReportCopied);
							}}
						>
							{reportCopied ? "Copied" : "Copy frame report"}
						</button>
					</div>
				) : null}

				<div className={styles.contentOverlay}>
					{!isPanel && showArtwork ? (
						<div className={styles.twoColumnContainer}>
							{/* Left Column: Artwork + Scrubber + Details */}
							<div className={styles.artworkColumn}>
								<div className={styles.artworkCard}>
									<div
										className={styles.artworkImageWrapper}
										onClick={handleTogglePlay}
										style={{ cursor: "pointer" }}
										title={isPlaying ? "Click to Pause" : "Click to Play"}
									>
										{songCoverArt ? (
											<img
												src={songCoverArt}
												alt={projectIdentity.name || "Album Artwork"}
												className={styles.artworkImage}
											/>
										) : (
											<div className={styles.artworkPlaceholder}>
												<MusicNote224Regular
													style={{
														fontSize: "64px",
														width: "64px",
														height: "64px",
													}}
												/>
											</div>
										)}
									</div>

									{/* Progress Scrubber */}
									<PreviewProgressBar
										totalDuration={totalDuration}
										variant="spicy"
									/>

									{/* Track details */}
									<div className={styles.trackDetails}>
										<h2 className={styles.songTitle}>
											{projectIdentity.name || "Untitled"}
										</h2>
										<div className={styles.songArtist}>
											{projectIdentity.artist || "Unknown Artist"}
										</div>
									</div>
								</div>
							</div>

							{/* Right Column: Lyrics Viewport */}
							<div className={styles.lyricsColumn}>{lyricsContent}</div>
						</div>
					) : (
						lyricsContent
					)}
				</div>
			</div>
		);
	},
);

export default SpicyLyrics;
