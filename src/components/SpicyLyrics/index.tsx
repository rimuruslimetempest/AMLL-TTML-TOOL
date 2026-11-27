/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import classNames from "classnames";
import { useAtomValue, useSetAtom } from "jotai";
import {
	type CSSProperties,
	memo,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioCoverArtAtom,
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
} from "$/modules/audio/states";
import { FrameDiagnostics } from "$/modules/performance/FrameDiagnostics";
import { frameScheduler } from "$/modules/performance/scheduler";
import { previewQualityLevelAtom } from "$/modules/performance/states";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import {
	backgroundModeAtom,
	customAccentColorAtom,
	performanceModeAtom,
	useCustomAccentAtom,
} from "$/modules/settings/states";
import {
	previewShowAlbumArtworkAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyBackgroundModeAtom,
	spicyForceLineSyncedAtom,
	spicySimpleLyricsModeAtom,
	bgFollowsDuetAtom,
	vsyncAtom,
} from "$/modules/settings/states/preview";
import { lyricLinesAtom, projectIdentityAtom } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import {
	MusicNote224Regular,
} from "@fluentui/react-icons";
import styles from "./index.module.css";
import { PreviewProgressBar } from "$/components/PreviewProgressBar";
import { CubicSpline, progressAt, Spring, stateAt } from "./math";
import { findSpicyScrollIndex } from "./active-line";
import {
	buildSpicyLines,
	groupSpicyTokens,
	isRtl,
	type SpicyLine,
	type SpicyToken,
} from "./model";
import { usePreviewScroll } from "./usePreviewScroll";
import { rowGap, useSpicyVirtualList } from "./useSpicyVirtualList";

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
type SpringSet = { scale: Spring; y: Spring; glow: Spring; opacity: Spring };
type CoverPalette = { base: string; highlight: string };
type SlmAnimation = {
	animation?: Animation;
	phase: "idle" | "pre" | "fill" | "sung";
};

const scaleSpline = new CubicSpline([
	[0, 0.95],
	[0.7, 1.0505],
	[1, 1],
]);
const letterScaleSpline = new CubicSpline([
	[0, 0.95],
	[0.7, 1.175],
	[1, 1],
]);
const ySpline = new CubicSpline([
	[0, 0.01],
	[0.9, -1 / 60],
	[1, 0],
]);
const letterYSpline = new CubicSpline([
	[0, 0.01],
	[0.9, -1 / 56],
	[1, 0],
]);
const simpleYSpline = new CubicSpline([
	[0, 0.01],
	[1, -0.033],
]);
const simpleLetterScaleSpline = new CubicSpline([
	[0, 0.95],
	[0.7, 1.07],
	[1, 1],
]);
const simpleLetterYSpline = new CubicSpline([
	[0, 0.01],
	[0.9, -1 / 62],
	[1, 0],
]);
const glowSpline = new CubicSpline([
	[0, 0],
	[0.15, 1],
	[0.6, 1],
	[1, 0],
]);
const lineGlowSpline = new CubicSpline([
	[0, 0],
	[0.5, 1],
	[1, 0],
]);
const dotScaleSpline = new CubicSpline([
	[0, 0.75],
	[0.7, 1.05],
	[1, 1],
]);
const dotYSpline = new CubicSpline([
	[0, 0],
	[0.9, -0.12],
	[1, 0],
]);
const dotGlowSpline = new CubicSpline([
	[0, 0],
	[0.6, 1],
	[1, 1],
]);
const dotOpacitySpline = new CubicSpline([
	[0, 0.35],
	[0.6, 1],
	[1, 1],
]);
const simpleDotOpacitySpline = new CubicSpline([
	[0, 0.27],
	[0.6, 1],
	[1, 1],
]);
const easeSinOut = (progress: number) => Math.sin((Math.PI * progress) / 2);

const keyFor = (line: SpicyLine, word: SpicyToken, index: number) =>
	`${line.id}:${word.id}:${index}`;

// Writing the same custom property every frame still invalidates style and
// paint work. Remember the last value per node and skip unchanged writes.
const writtenVars = new WeakMap<HTMLElement, Map<string, string>>();
function setCssVar(node: HTMLElement, name: string, value: string) {
	let values = writtenVars.get(node);
	if (!values) {
		values = new Map();
		writtenVars.set(node, values);
	}
	if (values.get(name) === value) return;
	values.set(name, value);
	node.style.setProperty(name, value);
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
	performanceMode: boolean,
	qualityLevel: number,
) {
	useEffect(() => {
		// Level 3 falls back to the static cover layer rendered by the preview.
		if (
			performanceMode ||
			qualityLevel >= 3 ||
			mode !== "animated" ||
			!image ||
			!container.current
		)
			return;
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
					blurPasses: qualityLevel >= 2 ? 2 : 4,
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
				let lastUpdate = 0;
				let lastEnergy = -1;
				const animate = (now: number) => {
					// Analyser reads and option churn do not need to run at frame rate,
					// and the simplified background keeps a steady speed instead.
					if (qualityLevel < 2 && now - lastUpdate >= 100) {
						audioEngine.analyserNode.getByteFrequencyData(bins);
						const energy =
							bins.reduce((sum, value) => sum + value, 0) /
							(bins.length * 255);
						if (Math.abs(energy - lastEnergy) > 0.01) {
							instance?.setOptions({ animationSpeed: 0.1 + energy * 0.35 });
							lastEnergy = energy;
						}
						lastUpdate = now;
					}
					frame = requestAnimationFrame(animate);
				};
				frame = requestAnimationFrame(animate);
			})
			.catch(() => container.current?.replaceChildren());
		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			instance?.dispose();
			container.current?.replaceChildren();
		};
	}, [container, image, mode, performanceMode, qualityLevel]);
}

export interface SpicyLyricsProps {
	isPanel?: boolean;
	lyricsOverride?: TTMLLyric;
}

export const SpicyLyrics = memo(
	({ isPanel = false, lyricsOverride }: SpicyLyricsProps) => {
		const storeLyrics = useAtomValue(lyricLinesAtom);
		const lyrics = lyricsOverride ?? storeLyrics;
		const projectIdentity = useAtomValue(projectIdentityAtom);
		const simple = useAtomValue(spicySimpleLyricsModeAtom);
		const forceLineSynced = useAtomValue(spicyForceLineSyncedAtom);
		const romanized = useAtomValue(showRomanLinesAtom);
		const showTranslation = useAtomValue(showTranslationLinesAtom);
		const showFps = useAtomValue(showFpsCounterAtom);
		const vsync = useAtomValue(vsyncAtom);
		const performanceMode = useAtomValue(performanceModeAtom);
		const backgroundMode = useAtomValue(spicyBackgroundModeAtom);
		const embeddedCoverArt = useAtomValue(audioCoverArtAtom);
		const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
		const useAccent = useAtomValue(useCustomAccentAtom);
		const accent = useAtomValue(customAccentColorAtom);
		const bgFollowsDuet = useAtomValue(bgFollowsDuetAtom);
		const setCurrentTime = useSetAtom(currentTimeAtom);
		const currentDuration = useAtomValue(currentDurationAtom);
		const isPlaying = useAtomValue(audioPlayingAtom);

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
		const backgroundImage =
			songCoverArt || (appBackgroundMode === "image" ? customBackgroundImage : null);
		const coverPalette = useCoverPalette(backgroundImage);
		const viewportRef = useRef<HTMLDivElement>(null);
		const backgroundRef = useRef<HTMLDivElement>(null);
		const lineNodes = useRef(new Map<string, HTMLDivElement>());
		const wordNodes = useRef(new Map<string, HTMLElement>());
		const springs = useRef(new Map<string, SpringSet>());
		const slmAnimations = useRef(new Map<string, SlmAnimation>());
		const forceFrameRef = useRef<() => void>(() => {});
		const qualityLevel = useAtomValue(previewQualityLevelAtom);
		const qualityRef = useRef(qualityLevel);
		const vsyncRef = useRef(vsync);
		useKawarpBackground(
			backgroundRef,
			backgroundImage,
			backgroundMode,
			performanceMode,
			qualityLevel,
		);

		// Only the rows around the viewport are mounted. The list measures each
		// row once and keeps its offset, so a long song no longer pays for
		// thousands of off-screen word and letter nodes every frame.
		const { rows, totalSize, measureRow, getTop } = useSpicyVirtualList(
			lines,
			viewportRef,
			() => forceFrameRef.current(),
		);

		// Follow the active line with the same measured offsets the list uses.
		// A row that is not mounted yet can still be targeted through getTop.
		const interludeWait = useRef<{ id: string; until: number } | null>(null);
		const getScrollTarget = useCallback(
			(timeMs: number) => {
				const index = findSpicyScrollIndex(lines, timeMs);
				if (index < 0) return undefined;
				const line = lines[index];
				let deferred = false;
				if (lines[index - 1]?.isDotLine) {
					const now = performance.now();
					if (interludeWait.current?.id !== line.id)
						interludeWait.current = { id: line.id, until: now + 240 };
					deferred = now < interludeWait.current.until;
				} else interludeWait.current = null;
				return {
					id: line.id,
					getTop: (anchor: number, offset: number) =>
						getTop(index, anchor, offset),
					deferred,
				};
			},
			[lines, getTop],
		);
		usePreviewScroll(viewportRef, getScrollTarget, 30);

		useEffect(() => {
			qualityRef.current = qualityLevel;
		}, [qualityLevel]);

		useEffect(() => {
			vsyncRef.current = vsync;
		}, [vsync]);

		useEffect(() => {
			if (simple) return;
			for (const [key, animation] of slmAnimations.current) {
				animation.animation?.cancel();
				wordNodes.current
					.get(key)
					?.style.removeProperty("--spicy-slm-gradient-position");
			}
			slmAnimations.current.clear();
		}, [simple]);

		useEffect(() => {
			// Line values written for the previous renderer pass must not outlive it.
			for (const node of lineNodes.current.values()) {
				node.style.removeProperty("--line-gradient-position");
				node.style.removeProperty("--line-shadow-blur");
				node.style.removeProperty("--line-shadow-alpha");
			}
			let previousPosition = -Infinity;
			let frameBudget = 0;
			let forceUntil = 0;
			let lastBlurIndex = Number.NaN;
			let lineGlow = new Spring(0, 1, 0.5);
			let lineGlowLineId: string | null = null;

			// Rows unmount when they leave the virtual window. Drop their spring
			// and Web Animation state with them so a remount starts clean instead
			// of resuming a stale pose.
			for (const key of springs.current.keys()) {
				if (!wordNodes.current.has(key)) springs.current.delete(key);
			}
			for (const [key, animation] of slmAnimations.current) {
				if (wordNodes.current.has(key)) continue;
				animation.animation?.cancel();
				slmAnimations.current.delete(key);
			}

			// Simple Lyrics Mode fills its gradient with a Web Animation. Once a
			// word is no longer active, pin that animation to its final value; the
			// CSS state below owns the pose and glow.
			const pinSlmWord = (
				word: SpicyToken,
				rootKey: string,
				root: HTMLElement | undefined,
				state: "sung" | "not-sung",
			) => {
				const position = state === "sung" ? "100%" : "-50%";
				const phase = state === "sung" ? "sung" : "idle";
				const pin = (nodeKey: string, node: HTMLElement | undefined) => {
					if (!node) return;
					const animation = slmAnimations.current.get(nodeKey);
					animation?.animation?.cancel();
					if (animation) {
						animation.animation = undefined;
						animation.phase = phase;
					} else {
						slmAnimations.current.set(nodeKey, { phase });
					}
					setCssVar(node, "--spicy-slm-gradient-position", position);
				};

				if (!word.letters) {
					pin(rootKey, root);
					return;
				}
				const letterDuration =
					(word.endTime - word.startTime) / word.letters.length;
				for (let index = 0; index < word.letters.length; index++) {
					const start = word.startTime + index * letterDuration;
					pin(`${rootKey}:${start}`, wordNodes.current.get(`${rootKey}:${start}`));
				}
			};

			// requestAnimationFrame is already paced by the display: running the
			// loop on every callback renders at the monitor's native refresh rate.
			// A time-based throttle here can only drop frames, which shows up as
			// judder and is exactly what a preview must not do.
			const animate = (frame: {
				now: number;
				dt: number;
				timeMs: number;
				playing: boolean;
			}) => {
				const now = frame.now;
				// VSync locks the preview to 60 FPS. requestAnimationFrame is already
				// paced by the display, so leaving it off follows the monitor instead
				// of capping the work.
				if (vsyncRef.current) {
					frameBudget += frame.dt;
					if (frameBudget < 15.9) return;
					frameBudget = 0;
				}
				const time = Math.max(
					0,
					frame.timeMs + (frame.playing ? 100 : 0) - (simple ? 33.5 : 0),
				);
				// A paused preview has no motion to animate. One extra frame still
				// runs after a seek or a lyric change so state and scroll settle.
				if (
					!frame.playing &&
					now > forceUntil &&
					Math.abs(time - previousPosition) < 0.25
				)
					return;
				// Virtual rows mount and unmount as the list scrolls. Discard any
				// spring or Web Animation that outlived its node, so a remount starts
				// from the correct rest pose instead of a stale one.
				for (const key of springs.current.keys()) {
					if (!wordNodes.current.has(key)) springs.current.delete(key);
				}
				for (const [key, animation] of slmAnimations.current) {
					if (wordNodes.current.has(key)) continue;
					animation.animation?.cancel();
					slmAnimations.current.delete(key);
				}
				const dt = Math.min(0.25, Math.max(0, frame.dt / 1000));
				const glowEnabled = qualityRef.current < 1;
				let firstActive = -1;
				let lastActive = -1;
				let activeCount = 0;
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (stateAt(time, line.startTime, line.endTime) === "active") {
						if (firstActive < 0) firstActive = i;
						lastActive = i;
						activeCount++;
					}
				}
				let activeIndex = firstActive;
				if (activeCount > 1) {
					activeIndex =
						lastActive - firstActive <= 1 ? firstActive : lastActive;
				}
				const active = activeIndex >= 0 ? lines[activeIndex] : undefined;
				if (!active || !active.isLineSynced || active.isDotLine || simple)
					lineGlowLineId = null;
				const blurChanged = activeIndex !== lastBlurIndex;
				lastBlurIndex = activeIndex;
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const status = stateAt(time, line.startTime, line.endTime);
					const node = lineNodes.current.get(line.id);
					if (!node) continue;
					if (node.dataset.state !== status) node.dataset.state = status;
					const prehidden = String(
						!!line.isDotLine &&
							(status === "not-sung" || time > line.endTime - 500),
					);
					if (node.dataset.prehidden !== prehidden)
						node.dataset.prehidden = prehidden;
					if (blurChanged) {
						const blur =
							status === "active"
								? 0
								: Math.min(Math.abs(i - activeIndex) * 1.25, 6.8);
						node.style.setProperty("--blur", `${blur}px`);
					}
					// Only the active line-synced line needs a per-frame sweep. Every
					// inactive line is pinned by its CSS [data-state] rule.
					if (
						active &&
						line.id === active.id &&
						line.isLineSynced &&
						!line.isDotLine &&
						!simple
					) {
						const progress = progressAt(time, line.startTime, line.endTime);
						if (lineGlowLineId !== line.id) {
							lineGlow = new Spring(0, 1, 0.5);
							lineGlowLineId = line.id;
						}
						lineGlow.setGoal(lineGlowSpline.at(progress));
						const currentGlow = lineGlow.step(dt);
						if (glowEnabled) {
							setCssVar(
								node,
								"--line-shadow-blur",
								`${(4 + 8 * currentGlow).toFixed(1)}px`,
							);
							setCssVar(
								node,
								"--line-shadow-alpha",
								(currentGlow * 0.5).toFixed(3),
							);
						}
						setCssVar(
							node,
							"--line-gradient-position",
							`${(Math.round(progress * 200) / 2).toFixed(1)}%`,
						);
					}
				}
				for (const line of lines) {
					// Only the line being sung needs per-frame word/letter animation.
					// Every other line keeps its full token DOM and rests in the exact
					// final pose supplied by its line state in CSS above.
					if (line.isLineSynced && !line.isDotLine) continue;
					if (stateAt(time, line.startTime, line.endTime) !== "active")
						continue;
					for (let wi = 0; wi < line.words.length; wi++) {
						const word = line.words[wi];
						const rootKey = keyFor(line, word, wi);
						const wordState = stateAt(time, word.startTime, word.endTime);
						const root = wordNodes.current.get(rootKey);
						const changed = !!root && root.dataset.wordState !== wordState;
						if (changed) root.dataset.wordState = wordState;

						// A settled word is owned entirely by CSS: its data-word-state
						// rule pins the exact final transform, gradient and glow. This is
						// the snap the old 300 ms spring cache never performed.
						if (wordState !== "active") {
							if (simple && changed)
								pinSlmWord(
									word,
									rootKey,
									root,
									wordState === "sung" ? "sung" : "not-sung",
								);
							continue;
						}
						if (!root) continue;
						const progress = progressAt(time, word.startTime, word.endTime);
						const slmStateFor = (nodeKey: string) => {
								let result = slmAnimations.current.get(nodeKey);
								if (!result) {
									result = { phase: "idle" };
									slmAnimations.current.set(nodeKey, result);
								}
								return result;
							};
							const pinSlmGradient = (
								nodeKey: string,
								node: HTMLElement | undefined,
								position: "-50%" | "100%",
							) => {
								if (!node) return;
								const animation = slmStateFor(nodeKey);
								const phase = position === "100%" ? "sung" : "idle";
								if (animation.phase === phase) return;
								animation.animation?.cancel();
								animation.animation = undefined;
								animation.phase = phase;
								setCssVar(
									node,
									"--spicy-slm-gradient-position",
									position,
								);
							};
							const runSlmAnimation = (
								nodeKey: string,
								node: HTMLElement | undefined,
								phase: "pre" | "fill",
								duration: number,
							) => {
								if (!node || !simple) return;
								const animation = slmStateFor(nodeKey);
								if (animation.phase === phase) return;
								animation.animation?.cancel();
								node.style.removeProperty("--spicy-slm-gradient-position");
								animation.phase = phase;
								animation.animation = node.animate(
									phase === "fill"
										? [
												{ "--spicy-slm-gradient-position": "-27.5%" },
												{ "--spicy-slm-gradient-position": "100%" },
											]
										: [
												{ "--spicy-slm-gradient-position": "-50%" },
												{ "--spicy-slm-gradient-position": "-27.5%" },
											],
									{
										duration: Math.max(0, duration),
										easing: "linear",
										fill: "forwards",
									},
								);
							};
							const prefillToken = (
								next: SpicyToken | undefined,
								nextIndex: number,
							) => {
								if (
									!next ||
									stateAt(time, next.startTime, next.endTime) !== "not-sung"
								)
									return;
								const nextKey = keyFor(line, next, nextIndex);
								if (next.letters) {
									for (let index = 0; index < next.letters.length; index++) {
										const letterStart =
											next.startTime +
											index *
												((next.endTime - next.startTime) / next.letters.length);
										runSlmAnimation(
											`${nextKey}:${letterStart}`,
											wordNodes.current.get(`${nextKey}:${letterStart}`),
											"pre",
											125,
										);
									}
								} else
									runSlmAnimation(
										nextKey,
										wordNodes.current.get(nextKey),
										"pre",
										125,
									);
							};
							const animateNode = (
								nodeKey: string,
								node: HTMLElement | undefined,
								p: number,
								isDot = false,
								letter = false,
							) => {
								if (!node) return;
								let set = springs.current.get(nodeKey);
								if (!set) {
									set = {
										scale: new Spring(
											isDot ? 0.75 : 0.95,
											isDot ? 0.7 : 0.88,
											isDot ? 0.6 : 0.64,
										),
										y: new Spring(isDot ? 0 : 0.01, isDot ? 1.25 : 1.45, 0.4),
										glow: new Spring(0, isDot ? 1 : 1.18, isDot ? 0.5 : 0.56),
										opacity: new Spring(isDot ? 0.35 : 1, 1, 0.5),
									};
									springs.current.set(nodeKey, set);
								}
								const scale = (
									isDot
										? dotScaleSpline
										: letter
											? letterScaleSpline
											: scaleSpline
								).at(p);
								const y = (
									isDot
										? dotYSpline
										: letter
											? simple
												? simpleLetterYSpline
												: letterYSpline
											: simple
												? simpleYSpline
												: ySpline
								).at(p);
								const glow = (isDot ? dotGlowSpline : glowSpline).at(p);
								const simpleWord = simple && !isDot && !letter;
								const simpleDot = simple && isDot;
								if (!simpleWord && !simpleDot) {
									set.scale.setGoal(scale);
									set.glow.setGoal(glow);
								}
								if (!simpleDot) set.y.setGoal(y);
								set.opacity.setGoal(
									isDot
										? simple
											? simpleDotOpacitySpline.at(p)
											: dotOpacitySpline.at(p)
										: 1,
								);
								const currentScale =
									simpleWord || simpleDot ? 1 : set.scale.step(dt);
								const currentY = simpleDot ? 0 : set.y.step(dt);
								const currentGlow =
									simpleWord || simpleDot ? 0 : set.glow.step(dt);
								// Spicy keeps translate and scale independent. Dots are 1.3× the
								// line font, but their vertical bounce is still measured against the
								// base lyric size, not their enlarged glyph size.
								node.style.transform = isDot
									? `translate3d(0, calc(var(--line-size) * ${currentY}), 0)`
									: `translate3d(0, ${currentY}em, 0)`;
								node.style.scale = currentScale.toFixed(4);
								if (!isDot) {
									if (simple) {
										const duration = word.endTime - word.startTime;
										if (wordState === "active") {
											runSlmAnimation(nodeKey, node, "fill", duration);
											if (time >= word.startTime + duration * 0.6 - 22)
												prefillToken(line.words[wi + 1], wi + 1);
										} else
											pinSlmGradient(
												nodeKey,
												node,
												wordState === "sung" ? "100%" : "-50%",
											);
									} else
										setCssVar(
											node,
											"--gradient-position",
											`${Math.round((wordState === "active" ? -20 + 120 * p : wordState === "sung" ? 100 : -20) * 2) / 2}%`,
										);
								}
								if (glowEnabled) {
									const blur =
										4 + (letter ? 12 : isDot ? 6 : 2) * currentGlow;
									setCssVar(node, "--shadow-blur", `${blur.toFixed(1)}px`);
									setCssVar(
										node,
										"--shadow-alpha",
										Math.min(
											1,
											currentGlow * (isDot ? 0.9 : letter ? 1 : 0.35),
										).toFixed(3),
									);
								}
								if (isDot)
									node.style.opacity = set.opacity.step(dt).toFixed(3);
							};
							const animateHeldGroup = (
								nodeKey: string,
								node: HTMLElement | undefined,
								p: number,
							) => {
								if (!node) return;
								let set = springs.current.get(nodeKey);
								if (!set) {
									set = {
										scale: new Spring(0.95, 0.88, 0.64),
										y: new Spring(0.01, 1.45, 0.4),
										glow: new Spring(0, 1.18, 0.56),
										opacity: new Spring(1, 1, 0.5),
									};
									springs.current.set(nodeKey, set);
								}
								// SLM deliberately disables the normal word bounce and glow. Held
								// letters retain their own smaller proximity effects below.
								if (!simple) {
									set.scale.setGoal(scaleSpline.at(p));
									set.glow.setGoal(glowSpline.at(p));
								}
								set.y.setGoal((simple ? simpleYSpline : ySpline).at(p));
								const currentScale = simple ? 1 : set.scale.step(dt);
								const currentY = set.y.step(dt);
								node.style.transform = `translateY(${currentY}em)`;
								node.style.scale = currentScale.toFixed(4);
							};
							const animateHeldLetters = (
								word: SpicyToken,
								rootKey: string,
								groupState: "not-sung" | "active" | "sung",
							) => {
								if (!word.letters) return;
								const letterDuration =
									(word.endTime - word.startTime) / word.letters.length;
								const letterInfo = word.letters.map((_, index) => {
									const start = word.startTime + index * letterDuration;
									return { start, end: start + letterDuration };
								});
								const activeIndex =
									groupState === "active"
										? letterInfo.findIndex(
												({ start, end }) =>
													stateAt(time, start, end) === "active",
											)
										: -1;
								const activeProgress =
									activeIndex === -1
										? 0
										: progressAt(
												time,
												letterInfo[activeIndex].start,
												letterInfo[activeIndex].end,
											);
								const letterScale = simple
									? simpleLetterScaleSpline
									: letterScaleSpline;
								const letterY = simple ? simpleLetterYSpline : letterYSpline;
								const wordDuration = word.endTime - word.startTime;
								if (
									simple &&
									groupState === "active" &&
									time >= word.startTime + wordDuration * 0.845 - 130
								)
									prefillToken(line.words[wi + 1], wi + 1);
								for (let index = 0; index < letterInfo.length; index++) {
									const { start, end } = letterInfo[index];
									const nodeKey = `${rootKey}:${start}`;
									const node = wordNodes.current.get(nodeKey);
									if (!node) continue;
									let set = springs.current.get(nodeKey);
									if (!set) {
										set = {
											scale: new Spring(letterScale.at(0), 0.88, 0.64),
											y: new Spring(letterY.at(0), 1.45, 0.4),
											glow: new Spring(glowSpline.at(0), 1.18, 0.56),
											opacity: new Spring(1, 1, 0.5),
										};
										springs.current.set(nodeKey, set);
									}

									// Spicy has distinct whole-group branches: before a held word, every
									// letter rests; after it, every letter finishes at its sung value. The
									// per-letter proximity wave only runs while its group is active.
									const letterState =
										groupState === "active"
											? stateAt(time, start, end)
											: groupState;
									let targetScale = letterScale.at(
										groupState === "sung" ? 1 : 0,
									);
									let targetY = letterY.at(groupState === "sung" ? 1 : 0);
									let targetGlow = glowSpline.at(groupState === "sung" ? 1 : 0);
									if (groupState === "active" && activeIndex !== -1) {
										const progress = simple
											? progressAt(time, word.startTime, word.endTime)
											: activeProgress;
										const strength =
											word.endTime - word.startTime > 1500
												? { glow: 0.4, y: 0.45, scale: 1.103 }
												: { glow: 0.285, y: 0.1, scale: 1.09 };
										const baseScale =
											letterScale.at(progress) * (simple ? strength.scale : 1);
										const baseY =
											letterY.at(progress) * (simple ? strength.y : 1);
										const baseGlow =
											glowSpline.at(progress) * (simple ? strength.glow : 1);
										const distance = Math.abs(index - activeIndex);
										const falloff = 1 / (1 + distance ** 2.8);
										const glowFalloff = 1 / (1 + distance * 0.9);
										targetScale += (baseScale - targetScale) * falloff;
										targetY += (baseY - targetY) * falloff;
										targetGlow += (baseGlow - targetGlow) * glowFalloff;
									}
									if (
										groupState === "active" &&
										letterState === "not-sung" &&
										!simple
									) {
										targetScale = letterScale.at(0);
										targetY = letterY.at(0);
										targetGlow = glowSpline.at(0);
									} else if (
										groupState === "active" &&
										letterState === "sung" &&
										activeIndex === -1
									) {
										targetGlow = glowSpline.at(0.2);
									}
									set.scale.setGoal(targetScale);
									set.y.setGoal(targetY);
									set.glow.setGoal(targetGlow);
									const currentScale = set.scale.step(dt);
									const currentY = set.y.step(dt);
									const currentGlow = set.glow.step(dt);
									const gradient =
										groupState === "sung"
											? 100
											: groupState === "not-sung"
												? simple
													? -50
													: -20
												: letterState === "sung"
													? 100
													: letterState === "active" && index === activeIndex
														? (simple ? -50 : -20) +
															120 * easeSinOut(activeProgress)
														: simple
															? -50
															: -20;
									if (simple) {
										if (letterState === "active")
											runSlmAnimation(nodeKey, node, "fill", end - start);
										else
											pinSlmGradient(
												nodeKey,
												node,
												letterState === "sung" ? "100%" : "-50%",
											);
									} else
										setCssVar(
											node,
											"--gradient-position",
											`${Math.round(gradient * 2) / 2}%`,
										);
									node.style.transform = `translateY(${currentY * 2}em)`;
									node.style.scale = currentScale.toFixed(4);
									if (glowEnabled) {
										setCssVar(
											node,
											"--shadow-blur",
											`${(4 + 12 * currentGlow).toFixed(1)}px`,
										);
										setCssVar(
											node,
											"--shadow-alpha",
											Math.min(1, currentGlow * 1.85).toFixed(3),
										);
									}
								}
							}
						if (line.isDotLine)
								animateNode(
									rootKey,
									wordNodes.current.get(rootKey),
									progress,
									true,
								);
													else if (word.letters) {
							animateHeldGroup(
								rootKey,
								wordNodes.current.get(rootKey),
								progress,
							);
							animateHeldLetters(word, rootKey, wordState);
						} else
							animateNode(rootKey, wordNodes.current.get(rootKey), progress);
						}
					}
				previousPosition = time;
			};
			const forceFrame = () => {
				forceUntil = performance.now() + 400;
			};
			// Newly mounted virtual rows need one full state pass before CSS can
			// own their resting pose.
			forceFrameRef.current = forceFrame;
			audioEngine.addEventListener("music-seeked", forceFrame);
			audioEngine.addEventListener("music-resume", forceFrame);
			audioEngine.addEventListener("music-pause", forceFrame);
			forceUntil = performance.now() + 400;
			const unsubscribe = frameScheduler.subscribe(animate, {
				audio: true,
				label: "lyrics",
			});
			return () => {
				unsubscribe();
				forceFrameRef.current = () => {};
				audioEngine.removeEventListener("music-seeked", forceFrame);
				audioEngine.removeEventListener("music-resume", forceFrame);
				audioEngine.removeEventListener("music-pause", forceFrame);
			};
		}, [lines, simple]);

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
				<div className={styles.virtualContent} style={{ height: totalSize }}>
					{rows.map(({ index, start }) => {
						const line = lines[index];
						if (!line) return null;
						return (
							<div
								key={line.id}
								ref={measureRow}
								data-index={index}
								className={styles.row}
								style={{
									transform: `translateY(${start}px)`,
									paddingBottom: `${rowGap(lines, index)}cqw`,
								}}
							>
								<div
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
										line.isUntimed && styles.lineUnsynced,
									)}
									dir={line.isRtl ? "rtl" : undefined}
									onClick={() => {
										if (line.isUntimed) return;
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
										<span className={styles.translation}>
											{line.translation}
										</span>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
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
		);


		return (
			<div
				className={classNames(styles.root, simple && styles.simple)}
				data-quality={qualityLevel}
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
							qualityLevel < 3 &&
							styles.animatedBackground,
					)}
				/>
				{backgroundMode === "color" ? (
					<div className={styles.colorBackground} />
				) : null}
				{(backgroundMode === "static" || qualityLevel >= 3) &&
				backgroundImage ? (
					<div
						className={styles.staticBackground}
						style={{ backgroundImage: `url("${backgroundImage}")` }}
					/>
				) : null}
				{backgroundMode === "static" && !backgroundImage ? (
					<div className={styles.staticFallback} />
				) : null}
				<div className={styles.overlay} />
				{showFps ? <FrameDiagnostics /> : null}

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
