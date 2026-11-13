/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/bobjoerules/AMLL-TTML-TOOL/blob/main/LICENSE
 */

import {
	ClipboardPaste16Regular,
	Dismiss16Regular,
} from "@fluentui/react-icons";
import { Button } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { timingCopyPlacementAtom } from "./lyric-line-view-states";
import styles from "./TimingApplyBar.module.css";

/**
 * New-layer status bar for the timing-copy placement flow. It deliberately
 * mirrors the existing banner's only job: explain the pending copy and let the
 * user cancel it. The actual apply action stays on the target lyric line.
 */
export function TimingApplyBar() {
	const [placement, setPlacement] = useAtom(timingCopyPlacementAtom);
	const { t } = useTranslation();

	if (!placement) return null;

	const count = placement.snapshots.length;

	return (
		<div
			className={styles.bar}
			data-new-timing-apply-bar=""
			role="region"
			aria-label={t(
				"lyricLineView.timingApplyRegion",
				"Pending timing copy",
			)}
			aria-live="polite"
		>
			<span className={styles.icon} aria-hidden="true">
				<ClipboardPaste16Regular />
			</span>
			<div className={styles.copy}>
				<span className={styles.title}>
					{t("lyricLineView.timingApplyTitle", "Apply copied timings")}
				</span>
				<span className={styles.hint}>
					{t(
						"lyricLineView.timingApplyHint",
						"Choose a target line in the editor, then use Apply timing.",
					)}
				</span>
			</div>
			<span className={styles.count}>
				{count}{" "}
				{count === 1
					? t("lyricLineView.timingApplyOne", "line timing")
					: t("lyricLineView.timingApplyMany", "line timings")}
			</span>
			<Button
				className={styles.cancel}
				size="1"
				variant="soft"
				color="gray"
				onClick={() => setPlacement(null)}
			>
				<Dismiss16Regular aria-hidden="true" />
				{t("common.cancel", "Cancel")}
				<kbd className={styles.kbd}>Esc</kbd>
			</Button>
		</div>
	);
}
