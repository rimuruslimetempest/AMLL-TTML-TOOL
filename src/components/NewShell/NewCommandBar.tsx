import { ChevronDown16Regular, ChevronUp16Regular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import RibbonBar from "$/components/RibbonBar";
import styles from "./NewCommandBar.module.css";
import { useOverflow } from "./useOverflow";

export interface NewCommandBarProps {
	position: "top" | "bottom";
}

/**
 * One-row host for the existing ribbon controls. The scroll width is measured
 * in JS; when the groups do not fit, "More" expands the same instance into a
 * wrapped, vertically scrollable panel instead of clipping controls.
 */
export function NewCommandBar({ position }: NewCommandBarProps) {
	const { t } = useTranslation();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(false);
	const overflowing = useOverflow(scrollRef, !expanded);
	const showMore = overflowing || expanded;

	return (
		<div
			className={styles.command}
			data-ttml-chrome="command"
			data-placement={position}
		>
			<div
				className={styles.scroll}
				ref={scrollRef}
				data-expanded={expanded ? "true" : "false"}
			>
				<RibbonBar position={position} />
			</div>
			{showMore ? (
				<button
					type="button"
					className={styles.more}
					onClick={() => setExpanded((value) => !value)}
					aria-expanded={expanded}
					aria-label={
						expanded
							? t("newShell.commandLess", "Show fewer controls")
							: t("newShell.commandMore", "Show more controls")
					}
					title={
						expanded
							? t("newShell.commandLess", "Show fewer controls")
							: t("newShell.commandMore", "Show more controls")
					}
				>
					{expanded ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
					<span>{expanded ? t("common.less", "Less") : t("common.more", "More")}</span>
				</button>
			) : null}
		</div>
	);
}
