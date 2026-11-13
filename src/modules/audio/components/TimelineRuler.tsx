import { useAtomValue, useSetAtom } from "jotai";
import { type FC, type KeyboardEvent, type PointerEvent, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentDurationAtom, currentTimeAtom } from "$/modules/audio/states";
import styles from "./TimelineRuler.module.css";

const MAJOR_STEPS_SECONDS = [
	1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800,
];

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function formatRulerTime(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(
			seconds,
		).padStart(2, "0")}`;
	}
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRulerValue(ms: number) {
	const totalSeconds = Math.max(0, ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export const TimelineRuler: FC = () => {
	const { t } = useTranslation();
	const currentTime = useAtomValue(currentTimeAtom);
	const duration = useAtomValue(currentDurationAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const hasAudio = duration > 0;

	const seekTo = useCallback(
		(ms: number) => {
			if (duration <= 0) return;
			const next = clamp(ms, 0, duration);
			audioEngine.seekMusic(next / 1000);
			setCurrentTime(Math.round(next));
		},
		[duration, setCurrentTime],
	);

	const seekFromPointer = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (!hasAudio || event.button !== 0) return;
			const rect = event.currentTarget.getBoundingClientRect();
			if (rect.width <= 0) return;
			const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
			seekTo(ratio * duration);
			event.currentTarget.focus();
		},
		[duration, hasAudio, seekTo],
	);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (!hasAudio) return;
			const step = event.shiftKey ? 5000 : 1000;
			let handled = true;
			switch (event.key) {
				case "ArrowLeft":
					seekTo(currentTime - step);
					break;
				case "ArrowRight":
					seekTo(currentTime + step);
					break;
				case "PageUp":
					seekTo(currentTime + 5000);
					break;
				case "PageDown":
					seekTo(currentTime - 5000);
					break;
				case "Home":
					seekTo(0);
					break;
				case "End":
					seekTo(duration);
					break;
				default:
					handled = false;
			}
			if (handled) {
				event.preventDefault();
				event.stopPropagation();
			}
		},
		[currentTime, duration, hasAudio, seekTo],
	);

	const { majors, minors } = useMemo(() => {
		if (duration <= 0) return { majors: [], minors: [] };
		const totalSeconds = duration / 1000;
		const targetStep = totalSeconds / 9;
		const step =
			MAJOR_STEPS_SECONDS.find((candidate) => candidate >= targetStep) ??
			3600;
		const majorTimes: number[] = [];
		for (let second = 0; second <= totalSeconds; second += step) {
			majorTimes.push(second * 1000);
		}
		const last = majorTimes[majorTimes.length - 1] ?? 0;
		if (last < duration - 40) majorTimes.push(duration);

		const minorTimes: number[] = [];
		const minorStep = step / 4;
		const minorCount = Math.ceil(totalSeconds / minorStep);
		for (let index = 1; index < minorCount; index += 1) {
			if (index % 4 === 0) continue;
			minorTimes.push(index * minorStep * 1000);
		}
		return { majors: majorTimes, minors: minorTimes };
	}, [duration]);

	const progress = hasAudio ? clamp(currentTime / duration, 0, 1) : 0;
	const valueText = hasAudio
		? `${formatRulerValue(currentTime)} / ${formatRulerValue(duration)}`
		: t("audio.timelineEmpty", "No audio loaded");

	return (
		<div
			className={styles.ruler}
			role="slider"
			tabIndex={hasAudio ? 0 : -1}
			aria-label={t("audio.timeline", "Audio timeline")}
			aria-valuemin={0}
			aria-valuemax={hasAudio ? Math.round(duration / 1000) : 0}
			aria-valuenow={hasAudio ? Math.round(currentTime / 1000) : 0}
			aria-valuetext={valueText}
			aria-disabled={hasAudio ? undefined : true}
			onPointerDown={seekFromPointer}
			onKeyDown={onKeyDown}
		>
			<div className={styles.track} aria-hidden="true">
				{minors.map((time, index) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed, evenly spaced decorative ticks
						key={`minor-${index}`}
						className={styles.minor}
						style={{ left: `${(time / duration) * 100}%` }}
					/>
				))}
				{majors.map((time, index) => {
					const isLast = index === majors.length - 1;
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed, evenly spaced decorative ticks
							key={`major-${index}`}
							className={styles.major}
							style={{ left: `${(time / duration) * 100}%` }}
						>
							<span className={styles.tick} />
							<span
								className={`${styles.label} ${
									isLast ? styles.labelLast : ""
								}`}
							>
								{formatRulerTime(time)}
							</span>
						</span>
					);
				})}
				{hasAudio ? (
					<span
						className={styles.playhead}
						style={{ left: `${progress * 100}%` }}
					>
						<span className={styles.playheadCap} />
					</span>
				) : (
					<span className={styles.empty}>
						{t("audio.timelineEmpty", "No audio loaded")}
					</span>
				)}
			</div>
		</div>
	);
};
