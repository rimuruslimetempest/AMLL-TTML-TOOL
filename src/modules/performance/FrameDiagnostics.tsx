import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "$/modules/changelog/data";
import { previewQualityAtom, previewQualityLevelAtom } from "./states";
import { frameStats } from "./frame-stats";
import { frameScheduler } from "./scheduler";
import "./FrameDiagnostics.css";

const UPDATE_INTERVAL_MS = 500;
const GRAPH_FRAMES = 120;
const GRAPH_HEIGHT = 44;

/**
 * The frame diagnostics panel. It writes into the DOM directly and reads a
 * snapshot twice a second, so opening it cannot invalidate React every frame.
 */
export function FrameDiagnostics() {
	const quality = useAtomValue(previewQualityAtom);
	const qualityLevel = useAtomValue(previewQualityLevelAtom);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fpsRef = useRef<HTMLSpanElement>(null);
	const detailRef = useRef<HTMLSpanElement>(null);
	const lowRef = useRef<HTMLSpanElement>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		// Keep the shared loop alive while the panel is open, even if the
		// preview itself is paused.
		return frameScheduler.subscribe(() => {}, { label: "diagnostics" });
	}, []);

	useEffect(() => {
		const draw = () => {
			const budget = frameScheduler.budgetMs;
			// Report the 60 FPS floor separately from the display's own budget.
			const snapshot = frameStats.snapshot(16.7);
			if (fpsRef.current) {
				fpsRef.current.textContent = `${Math.round(snapshot.fps)} FPS`;
			}
			if (detailRef.current) {
				detailRef.current.textContent = `${frameScheduler.hz} Hz · avg ${snapshot.averageMs.toFixed(1)} ms · ${Math.round(snapshot.overBudgetPercent)}% over 16.7 ms`;
			}
			if (lowRef.current) {
				lowRef.current.textContent = `1% low ${Math.round(snapshot.onePercentLowFps)} FPS · worst 5 s ${snapshot.worstMs.toFixed(1)} ms`;
			}

			const canvas = canvasRef.current;
			const context = canvas?.getContext("2d");
			if (!canvas || !context) return;
			const history = frameStats.history(GRAPH_FRAMES);
			const width = canvas.width;
			const height = canvas.height;
			context.clearRect(0, 0, width, height);
			context.fillStyle = "rgba(8, 10, 14, 0.55)";
			context.fillRect(0, 0, width, height);

			const scaleMax = Math.max(33.4, snapshot.worstMs * 1.1);
			const xStep = width / GRAPH_FRAMES;
			for (let index = 0; index < history.length; index++) {
				const ms = history[index] ?? 0;
				const barHeight = Math.max(1, (ms / scaleMax) * height);
				context.fillStyle =
					ms > 22
						? "rgba(255, 107, 107, 0.9)"
						: ms > budget
							? "rgba(255, 196, 87, 0.85)"
							: "rgba(105, 219, 154, 0.8)";
				context.fillRect(
					width - (history.length - index) * xStep,
					height - barHeight,
					Math.max(1, xStep - 1),
					barHeight,
				);
			}

			// 60 FPS floor and the display's own budget.
			const floorY = height - (16.7 / scaleMax) * height;
			const budgetY = height - (budget / scaleMax) * height;
			context.strokeStyle = "rgba(255, 255, 255, 0.35)";
			context.setLineDash([3, 3]);
			context.beginPath();
			context.moveTo(0, floorY);
			context.lineTo(width, floorY);
			context.stroke();
			context.strokeStyle = "rgba(122, 185, 255, 0.5)";
			context.beginPath();
			context.moveTo(0, budgetY);
			context.lineTo(width, budgetY);
			context.stroke();
			context.setLineDash([]);
		};

		draw();
		const timer = window.setInterval(draw, UPDATE_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, []);

	const copyReport = useCallback(() => {
		const budget = frameScheduler.budgetMs;
		const snapshot = frameStats.snapshot(16.7);
		const slow = frameStats
			.slowFrames()
			.slice(-20)
			.map((frame) => `${frame.ms.toFixed(1)} ms${frame.label ? ` (${frame.label})` : ""}`)
			.join(", ");
		const report = [
			`TTML Tool ${APP_VERSION} frame report`,
			`Platform: ${navigator.userAgent}`,
			`Display refresh: ${frameScheduler.hz} Hz (budget ${budget.toFixed(2)} ms)`,
			`FPS: ${snapshot.fps.toFixed(1)}`,
			`Average frame: ${snapshot.averageMs.toFixed(2)} ms`,
			`1% low: ${snapshot.onePercentLowFps.toFixed(1)} FPS (${snapshot.onePercentLowMs.toFixed(2)} ms)`,
			`Worst frame (5 s): ${snapshot.worstMs.toFixed(2)} ms`,
			`Frames over 16.7 ms: ${snapshot.overBudgetPercent.toFixed(1)}%`,
			`Quality: ${quality} (level ${qualityLevel})`,
			`Slow frames: ${slow || "none"}`,
		].join("\n");
		if (!navigator.clipboard) return;
		void navigator.clipboard.writeText(report).then(
			() => {
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1500);
			},
			() => {},
		);
	}, [quality, qualityLevel]);

	return (
		<div className="preview-frame-diagnostics" data-preview-diagnostics>
			<div className="preview-frame-diagnostics__row">
				<span ref={fpsRef}>0 FPS</span>
				<span ref={detailRef}>measuring…</span>
			</div>
			<div className="preview-frame-diagnostics__row preview-frame-diagnostics__muted">
				<span ref={lowRef}>1% low —</span>
			</div>
			<canvas
				ref={canvasRef}
				width={240}
				height={GRAPH_HEIGHT}
				className="preview-frame-diagnostics__graph"
			/>
			<button type="button" onClick={copyReport}>
				{copied ? "Copied" : "Copy frame report"}
			</button>
		</div>
	);
}
