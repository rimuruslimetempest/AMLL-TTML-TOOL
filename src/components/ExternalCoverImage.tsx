import { MusicNote2Filled } from "@fluentui/react-icons";
import { useState, type CSSProperties } from "react";

type ExternalCoverImageProps = {
	src?: string | null;
	alt: string;
	size: number;
	borderRadius?: number;
	style?: CSSProperties;
};

type Attempt = "cors" | "plain" | "failed";

const LOCAL_SOURCE = /^(data|blob):/i;

/**
 * Cover art from remote CDNs. Requests CORS first (required when the app is
 * cross-origin isolated), falls back to a plain request, then to a note icon
 * instead of leaving the browser's broken-image placeholder in the list.
 */
export const ExternalCoverImage = ({
	src,
	alt,
	size,
	borderRadius = 6,
	style,
}: ExternalCoverImageProps) => {
	const [attemptState, setAttemptState] = useState<{
		src?: string | null;
		attempt: Attempt;
	}>({ src, attempt: "cors" });
	// A changed cover starts over at the CORS attempt without an effect.
	const attempt = attemptState.src === src ? attemptState.attempt : "cors";

	const isLocal = Boolean(src && LOCAL_SOURCE.test(src));
	const boxStyle: CSSProperties = {
		width: size,
		height: size,
		borderRadius,
		flexShrink: 0,
		...style,
	};

	if (!src || attempt === "failed") {
		return (
			<div
				role="img"
				aria-label={alt}
				style={{
					...boxStyle,
					backgroundColor: "var(--gray-a4)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<MusicNote2Filled
					style={{
						width: Math.round(size * 0.45),
						height: Math.round(size * 0.45),
						color: "var(--accent-9)",
					}}
				/>
			</div>
		);
	}

	return (
		<img
			key={attempt}
			src={src}
			alt={alt}
			crossOrigin={
				!isLocal && attempt === "cors" ? "anonymous" : undefined
			}
			referrerPolicy="no-referrer"
			loading="lazy"
			decoding="async"
			onError={() =>
				setAttemptState({
					src,
					attempt: isLocal || attempt !== "cors" ? "failed" : "plain",
				})
			}
			style={{
				...boxStyle,
				objectFit: "cover",
				backgroundColor: "var(--gray-a4)",
			}}
		/>
	);
};