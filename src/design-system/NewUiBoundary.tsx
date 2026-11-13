import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type ErrorInfo, type ReactNode, useCallback, useEffect } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { captureDiagnosticException } from "$/modules/privacy/diagnostics";
import { UiLayer, uiLayerAtom } from "$/modules/settings/states";
import styles from "./design-system.module.css";
import { uiFallbackNoticeAtom } from "./state";

function NewUiErrorFallback({ error }: FallbackProps) {
	return (
		<div className={styles.fallbackScreen} role="alert">
			<div className={styles.fallbackCard}>
				<h1>Switching to Classic</h1>
				<p>
					The New interface encountered a problem. Classic is being restored so
					you can keep working. Your project state is unchanged.
				</p>
				{import.meta.env.DEV ? (
					<pre className={styles.fallbackError}>{String(error)}</pre>
				) : null}
			</div>
		</div>
	);
}

function NewUiFallbackBanner() {
	const [notice, setNotice] = useAtom(uiFallbackNoticeAtom);

	if (!notice) return null;

	return (
		<div className={styles.fallbackBanner} role="status">
			<span className={styles.fallbackBannerText}>
				The New interface hit a problem, so Classic is active. Your project
				state is unchanged.
			</span>
			<button
				type="button"
				className={styles.fallbackBannerButton}
				onClick={() => setNotice(false)}
			>
				Dismiss
			</button>
		</div>
	);
}

function ClassicUiShortcut() {
	const setUiLayer = useSetAtom(uiLayerAtom);
	const setNotice = useSetAtom(uiFallbackNoticeAtom);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				!event.ctrlKey ||
				!event.shiftKey ||
				!event.altKey ||
				event.code !== "KeyC" ||
				event.repeat
			) {
				return;
			}

			event.preventDefault();
			setNotice(false);
			setUiLayer(UiLayer.Classic);
		};

		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, [setNotice, setUiLayer]);

	return null;
}

export interface NewUiBoundaryProps {
	children: ReactNode;
}

/**
 * Keeps Classic completely outside the New interface boundary. When New throws,
 * the layer switches to Classic and a persistent banner explains what happened.
 */
export function NewUiBoundary({ children }: NewUiBoundaryProps) {
	const uiLayer = useAtomValue(uiLayerAtom);
	const setUiLayer = useSetAtom(uiLayerAtom);
	const setNotice = useSetAtom(uiFallbackNoticeAtom);

	const handleError = useCallback(
		(error: Error, info: ErrorInfo) => {
			captureDiagnosticException(error, {
				componentStack: info.componentStack,
			});
			setNotice(true);
			setUiLayer(UiLayer.Classic);
		},
		[setNotice, setUiLayer],
	);

	return (
		<>
			<ClassicUiShortcut />
			<NewUiFallbackBanner />
			{uiLayer === UiLayer.New ? (
				<ErrorBoundary
					FallbackComponent={NewUiErrorFallback}
					onError={handleError}
				>
					{children}
				</ErrorBoundary>
			) : (
				children
			)}
		</>
	);
}
