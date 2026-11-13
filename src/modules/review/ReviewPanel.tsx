import {
	ArrowDownload16Regular,
	Checkmark16Regular,
	Copy16Regular,
	Play16Regular,
	Warning16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Flex,
	SegmentedControl,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom } from "$/modules/audio/states";
import { buildReviewSummaryMarkdown } from "$/modules/collab/project-data";
import { collabClient } from "$/modules/collab/client";
import {
	aggregateReviewStatus,
	REVIEW_STATUS_LABEL,
	reviewMarkFor,
	type ReviewStatus,
} from "$/modules/collab/model";
import { can } from "$/modules/collab/permissions";
import {
	collabCommentsAtom,
	collabRoleAtom,
	collabReviewMarksAtom,
	collabSelfIdAtom,
} from "$/modules/collab/states";
import {
	Drawer,
	Hint,
	PaneSection,
	ReviewIcon,
	focusLine,
	formatWhen,
} from "$/modules/collab/ui";
import styles from "$/modules/collab/collab-ui.module.css";
import { lyricLinesAtom } from "$/states/main";

type Filter = "all" | "needs-fix" | "unsure" | "unreviewed";

function downloadText(name: string, text: string) {
	const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewPanel({ onClose }: { onClose: () => void }) {
	const lyrics = useAtomValue(lyricLinesAtom);
	const marks = useAtomValue(collabReviewMarksAtom);
	const comments = useAtomValue(collabCommentsAtom);
	const role = useAtomValue(collabRoleAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const [filter, setFilter] = useState<Filter>("all");
	const [noteLineId, setNoteLineId] = useState<string | null>(null);
	const [noteDraft, setNoteDraft] = useState("");
	const [loopLineId, setLoopLineId] = useState<string | null>(null);

	const canReview = can(role, "review");
	const lines = lyrics.lyricLines;

	const stats = useMemo(() => {
		let ok = 0;
		let needs = 0;
		let unsure = 0;
		let reviewed = 0;
		for (const line of lines) {
			const status = aggregateReviewStatus(marks, line.id);
			if (!status) continue;
			reviewed += 1;
			if (status === "ok") ok += 1;
			else if (status === "needs-fix") needs += 1;
			else unsure += 1;
		}
		return { ok, needs, unsure, reviewed, total: lines.length };
	}, [lines, marks]);

	const visible = useMemo(() => {
		return lines.filter((line) => {
			const status = aggregateReviewStatus(marks, line.id);
			if (filter === "all") return true;
			if (filter === "unreviewed") return !status;
			return status === filter;
		});
	}, [lines, marks, filter]);

	useEffect(() => {
		if (!playing || !loopLineId) return;
		const line = lines.find((item) => item.id === loopLineId);
		if (!line) return;
		const timer = setInterval(() => {
			if (
				audioEngine.musicCurrentTime * 1000 >
				Math.max(line.endTime, line.startTime + 250)
			) {
				audioEngine.seekMusic(line.startTime / 1000);
			}
		}, 150);
		return () => clearInterval(timer);
	}, [playing, loopLineId, lines]);

	const playLine = (lineId: string, loop: boolean) => {
		const line = lines.find((item) => item.id === lineId);
		if (!line) return;
		if (!audioEngine.musicLoaded) {
			toast.info("Load song audio to play a line.");
			return;
		}
		focusLine(lineId);
		audioEngine.seekMusic(line.startTime / 1000);
		audioEngine.resumeOrSeekMusic();
		setLoopLineId(loop ? lineId : null);
	};

	const mark = (lineId: string, status: ReviewStatus, note?: string) => {
		if (!canReview) {
			collabClient.notify("review");
			return;
		}
		if (collabClient.reviewMark(lineId, status, note)) {
			setNoteLineId(null);
			setNoteDraft("");
		}
	};

	const exportSummary = async () => {
		const text = buildReviewSummaryMarkdown(
			lines.map((line) => ({
				id: line.id,
				text: line.words.map((word) => word.word).join(""),
			})),
			marks,
			comments,
		);
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Review summary copied");
		} catch {
			toast.info("Copy failed; downloading instead.");
		}
		downloadText("review-notes.md", text);
	};

	const percent =
		stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;

	return (
		<Drawer
			title="Review mode"
			subtitle={`${stats.reviewed}/${stats.total} lines reviewed · ${percent}%`}
			onClose={onClose}
			footer={
				<>
					<Button variant="soft" color="gray" onClick={exportSummary}>
						<Copy16Regular /> Copy summary
					</Button>
					<Button variant="soft" color="gray" onClick={onClose}>
						Done
					</Button>
				</>
			}
		>
			<PaneSection title="Progress">
				<div className={styles.progressTrack}>
					<div
						className={styles.progressFill}
						style={{ width: `${percent}%` }}
					/>
				</div>
				<Flex gap="2" wrap="wrap">
					<Badge color="green" variant="soft">
						{stats.ok} OK
					</Badge>
					<Badge color="amber" variant="soft">
						{stats.needs} need fix
					</Badge>
					<Badge color="orange" variant="soft">
						{stats.unsure} unsure
					</Badge>
					<Badge color="gray" variant="soft">
						{Math.max(0, stats.total - stats.reviewed)} not reviewed
					</Badge>
				</Flex>
				<Button
					size="1"
					variant="soft"
					color="gray"
					onClick={() => downloadText("review-notes.md", buildReviewSummaryMarkdown(
						lines.map((line) => ({
							id: line.id,
							text: line.words.map((word) => word.word).join(""),
						})),
						marks,
						comments,
					))}
				>
					<ArrowDownload16Regular /> Download Markdown
				</Button>
				<Hint>
					Review notes are stored with the project and never written into the
					TTML file. Export the summary to share it outside the app.
				</Hint>
			</PaneSection>

			<SegmentedControl.Root
				value={filter}
				onValueChange={(value) => setFilter(value as Filter)}
				size="1"
			>
				<SegmentedControl.Item value="all">All</SegmentedControl.Item>
				<SegmentedControl.Item value="needs-fix">Needs fix</SegmentedControl.Item>
				<SegmentedControl.Item value="unsure">Unsure</SegmentedControl.Item>
				<SegmentedControl.Item value="unreviewed">To do</SegmentedControl.Item>
			</SegmentedControl.Root>

			<PaneSection title={`Lines (${visible.length})`}>
				{visible.length === 0 ? <Hint>No lines match this filter.</Hint> : null}
				<div className={styles.list}>
					{visible.slice(0, 400).map((line) => {
						const lineIndex = lines.indexOf(line) + 1;
						const aggregate = aggregateReviewStatus(marks, line.id);
						const mine = reviewMarkFor(marks, line.id, selfId);
						const lineComments = comments.filter(
							(comment) =>
								comment.lineId === line.id &&
								!comment.parentId &&
								!comment.resolved,
						);
						return (
							<div key={line.id} className={styles.reviewRow}>
								<ReviewIcon status={aggregate} />
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Flex align="center" gap="1" wrap="wrap">
										<Button
											size="1"
											variant="ghost"
											onClick={() => focusLine(line.id)}
										>
											Line {lineIndex}
										</Button>
										{aggregate ? (
											<Badge
												size="1"
												variant="soft"
												color={
													aggregate === "ok"
														? "green"
														: aggregate === "needs-fix"
															? "amber"
															: "orange"
												}
											>
												{REVIEW_STATUS_LABEL[aggregate]}
											</Badge>
										) : null}
										{lineComments.length ? (
											<Badge size="1" color="blue">
												{lineComments.length} comment
												{lineComments.length === 1 ? "" : "s"}
											</Badge>
										) : null}
									</Flex>
									<Text size="1" as="div" className={styles.threadText}>
										{line.words.map((word) => word.word).join("") || "(empty)"}
									</Text>
									<Flex gap="1" wrap="wrap" mt="1">
										<Button size="1" variant="soft" color="green" onClick={() => mark(line.id, "ok", mine?.note)}>
											<Checkmark16Regular /> OK
										</Button>
										<Button
											size="1"
											variant={aggregate === "needs-fix" ? "solid" : "soft"}
											color="amber"
											onClick={() => {
												setNoteLineId(line.id);
												setNoteDraft(mine?.note ?? "");
											}}
										>
											<Warning16Regular /> Needs fix
										</Button>
										<Button size="1" variant="soft" color="orange" onClick={() => mark(line.id, "unsure", mine?.note)}>
											Unsure
										</Button>
										<Button
											size="1"
											variant="ghost"
											onClick={() => playLine(line.id, false)}
										>
											<Play16Regular /> Play
										</Button>
										<Button
											size="1"
											variant={loopLineId === line.id ? "solid" : "ghost"}
											onClick={() => playLine(line.id, true)}
										>
											Loop
										</Button>
									</Flex>
									{noteLineId === line.id ? (
										<Flex direction="column" gap="1" mt="1">
											<TextArea
												rows={2}
												value={noteDraft}
												placeholder="What needs fixing? This note is saved with the mark."
												onChange={(event) => setNoteDraft(event.currentTarget.value)}
											/>
											<Flex justify="end" gap="1">
												<Button
													size="1"
													variant="soft"
													color="gray"
													onClick={() => setNoteLineId(null)}
												>
													Cancel
												</Button>
												<Button
													size="1"
													color="amber"
													onClick={() => mark(line.id, "needs-fix", noteDraft)}
												>
													Save note and mark
												</Button>
											</Flex>
										</Flex>
									) : null}
									{mine?.note && noteLineId !== line.id ? (
										<Text size="1" color="gray" as="div">
											Your note: {mine.note} · {formatWhen(mine.at)}
										</Text>
									) : null}
								</Box>
							</div>
						);
					})}
				</div>
			</PaneSection>
		</Drawer>
	);
}
