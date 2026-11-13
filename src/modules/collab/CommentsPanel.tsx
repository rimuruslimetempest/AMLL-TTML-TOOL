import {
	Chat16Regular,
	Checkmark16Regular,
	Delete16Regular,
	Edit16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Flex,
	SegmentedControl,
	Text,
	TextArea,
	Tooltip,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { lyricLinesAtom, selectedLinesAtom, selectedWordsAtom } from "$/states/main";
import { collabClient } from "./client";
import {
	groupCommentThreads,
	openCommentCount,
	type CollabComment,
} from "./model";
import { can, denialMessage } from "./permissions";
import {
	collabCommentsAtom,
	collabMembersAtom,
	collabRoleAtom,
	collabSelfIdAtom,
} from "./states";
import {
	AvatarDot,
	Drawer,
	Hint,
	PaneSection,
	focusLine,
	formatWhen,
} from "./ui";
import styles from "./collab-ui.module.css";

type Filter = "open" | "all" | "resolved" | "mine";

export function CommentsPanel({ onClose }: { onClose: () => void }) {
	const comments = useAtomValue(collabCommentsAtom);
	const members = useAtomValue(collabMembersAtom);
	const role = useAtomValue(collabRoleAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const [filter, setFilter] = useState<Filter>("open");
	const [text, setText] = useState("");
	const [replyTo, setReplyTo] = useState<string | null>(null);
	const [replyText, setReplyText] = useState("");
	const [editing, setEditing] = useState<{ id: string; text: string } | null>(
		null,
	);
	const nextOpenIndex = useRef(0);

	const lineById = useMemo(() => {
		const map = new Map<string, { index: number; text: string }>();
		lyricLines.lyricLines.forEach((line, index) => {
			map.set(line.id, {
				index: index + 1,
				text: line.words.map((word) => word.word).join(""),
			});
		});
		return map;
	}, [lyricLines]);

	const threads = useMemo(() => groupCommentThreads(comments), [comments]);

	const visible = useMemo(() => {
		return threads.filter((thread) => {
			if (filter === "mine") {
				return thread.comments.some(
					(comment) => comment.authorId === selfId && !comment.parentId,
				);
			}
			const root = thread.comments.find((comment) => !comment.parentId);
			if (filter === "open") return !root?.resolved;
			if (filter === "resolved") return Boolean(root?.resolved);
			return true;
		});
	}, [threads, filter, selfId]);

	const selectedLineId = selectedLines.size === 1 ? [...selectedLines][0] : null;
	const selectedWordId =
		selectedLineId && selectedWords.size === 1 ? [...selectedWords][0] : null;
	const canComment = can(role, "comment");

	const send = (lineId: string, wordId?: string, parentId?: string) => {
		const value = parentId ? replyText.trim() : text.trim();
		if (!value) return;
		if (!canComment) {
			collabClient.notify("comment");
			return;
		}
		const ok = collabClient.comment("create", {
			lineId,
			wordId,
			parentId,
			text: value,
		});
		if (ok) {
			if (parentId) {
				setReplyText("");
				setReplyTo(null);
			} else {
				setText("");
			}
			focusLine(lineId);
		}
	};

	const jumpToNextOpen = () => {
		const open = threads.filter(
			(thread) => thread.comments.some((comment) => !comment.parentId),
		);
		const unResolved = open.filter((thread) => {
			const root = thread.comments.find((comment) => !comment.parentId);
			return !root?.resolved;
		});
		if (unResolved.length === 0) return;
		const thread = unResolved[nextOpenIndex.current % unResolved.length];
		nextOpenIndex.current += 1;
		focusLine(thread.lineId);
	};

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!event.altKey || event.ctrlKey || event.metaKey) return;
			if (event.key.toLowerCase() !== "c") return;
			const target = event.target as HTMLElement | null;
			if (
				target?.isContentEditable ||
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA"
			) {
				return;
			}
			event.preventDefault();
			jumpToNextOpen();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	const authorOf = (comment: CollabComment) =>
		members.find((member) => member.id === comment.authorId) ?? {
			name: comment.authorName,
			color: comment.authorColor,
		};

	return (
		<Drawer
			title="Comments"
			subtitle={`${openCommentCount(comments)} open · Alt+C to jump to the next one`}
			onClose={onClose}
			footer={
				<>
					<Button variant="soft" color="gray" onClick={jumpToNextOpen}>
						Next open
					</Button>
					<Button variant="soft" onClick={onClose}>
						Done
					</Button>
				</>
			}
		>
			<SegmentedControl.Root
				value={filter}
				onValueChange={(value) => setFilter(value as Filter)}
				size="1"
			>
				<SegmentedControl.Item value="open">Open</SegmentedControl.Item>
				<SegmentedControl.Item value="all">All</SegmentedControl.Item>
				<SegmentedControl.Item value="resolved">Resolved</SegmentedControl.Item>
				<SegmentedControl.Item value="mine">Mine</SegmentedControl.Item>
			</SegmentedControl.Root>

			<PaneSection
				title={
					selectedLineId
						? `New comment on line ${lineById.get(selectedLineId)?.index ?? "?"}${selectedWordId ? ", word" : ""}`
						: "New comment"
				}
			>
				{selectedLineId ? (
					<>
						<Text size="1" color="gray" className={styles.threadText} as="div">
							{lineById.get(selectedLineId)?.text || "(empty line)"}
						</Text>
						<TextArea
							value={text}
							onChange={(event) => setText(event.currentTarget.value)}
							placeholder={
								canComment
									? "Leave a note. Use @name to mention someone."
									: "Your role can't add comments."
							}
							disabled={!canComment}
							rows={2}
						/>
						<Flex justify="end" gap="2">
							{!canComment ? (
								<Hint>{denialMessage(role, "comment")}</Hint>
							) : null}
							<Button
								size="1"
								disabled={!canComment || !text.trim()}
								onClick={() => send(selectedLineId, selectedWordId)}
							>
								<Chat16Regular /> Comment
							</Button>
						</Flex>
					</>
				) : (
					<Hint>
						Select a line (or a word) in the editor to start a comment thread.
					</Hint>
				)}
			</PaneSection>

			<PaneSection
				title={`Threads (${visible.length})`}
				action={<Search16Regular color="var(--gray-8)" />}
			>
				{visible.length === 0 ? (
					<Hint>
						{filter === "open"
							? "No open comments. Nice."
							: "No comments match this filter."}
					</Hint>
				) : null}
				<div className={styles.list}>
					{visible.map((thread) => {
						const root = thread.comments.find((comment) => !comment.parentId);
						if (!root) return null;
						const line = lineById.get(thread.lineId);
						const resolved = Boolean(root.resolved);
						return (
							<div key={root.id} className={styles.row}>
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Flex align="center" gap="1" wrap="wrap">
										<Button
											size="1"
											variant="ghost"
											onClick={() => focusLine(thread.lineId)}
										>
											Line {line?.index ?? "?"}
										</Button>
										{thread.wordId ? (
											<Badge size="1" variant="soft">
												Word
											</Badge>
										) : null}
										{resolved ? (
											<Badge size="1" color="green">
												Resolved
											</Badge>
										) : (
											<Badge size="1" color="amber">
												Open
											</Badge>
										)}
									</Flex>
									<Text size="1" color="gray" as="div">
										{line?.text || "(line removed)"}
									</Text>
									{thread.comments.map((comment, index) => {
										const author = authorOf(comment);
										const own = comment.authorId === selfId;
										return (
											<div
												key={comment.id}
												className={index > 0 ? styles.reply : undefined}
												style={{ marginTop: 6 }}
											>
												<Flex align="center" gap="1" wrap="wrap">
													<AvatarDot member={author} size={18} />
													<Text size="1" weight="bold">
														{comment.authorName}
														{own ? " (you)" : ""}
													</Text>
													<Text size="1" color="gray">
														{formatWhen(comment.at)}
														{comment.editedAt ? " · edited" : ""}
													</Text>
												</Flex>
												{editing?.id === comment.id ? (
													<Flex direction="column" gap="1" mt="1">
														<TextArea
															rows={2}
															value={editing.text}
															onChange={(event) =>
																setEditing({
																	id: comment.id,
																	text: event.currentTarget.value,
																})
															}
														/>
														<Flex gap="1" justify="end">
															<Button
																size="1"
																variant="soft"
																color="gray"
																onClick={() => setEditing(null)}
															>
																Cancel
															</Button>
															<Button
																size="1"
																disabled={!editing.text.trim()}
																onClick={() => {
																	if (
																		collabClient.comment("edit", {
																			commentId: comment.id,
																			text: editing.text,
																		})
																	) {
																		setEditing(null);
																	}
																}}
															>
																Save
															</Button>
														</Flex>
													</Flex>
												) : (
													<Text
														size="2"
														as="div"
														className={styles.threadText}
													>
														{comment.text}
													</Text>
												)}
												<Flex gap="1" wrap="wrap" mt="1">
													{!comment.parentId ? (
														<Button
															size="1"
															variant="ghost"
															color="gray"
															onClick={() =>
																setReplyTo(
																	replyTo === comment.id ? null : comment.id,
																)
															}
														>
															Reply
														</Button>
													) : null}
													{own ? (
														<Button
															size="1"
															variant="ghost"
															color="gray"
															onClick={() =>
																setEditing({ id: comment.id, text: comment.text })
															}
														>
															<Edit16Regular /> Edit
														</Button>
													) : null}
													{own || role === "host" ? (
														<Button
															size="1"
															variant="ghost"
															color="red"
															onClick={() => {
																if (
																	window.confirm(
																		"Delete this comment? Replies stay in the thread.",
																	)
																) {
																	collabClient.comment("delete", {
																		commentId: comment.id,
																	});
																}
															}}
														>
															<Delete16Regular />
														</Button>
													) : null}
													{!comment.parentId ? (
														<Button
															size="1"
															variant="ghost"
															color={resolved ? "gray" : "green"}
															onClick={() =>
																collabClient.comment("resolve", {
																	commentId: comment.id,
																	resolved: !resolved,
																})
															}
														>
															<Checkmark16Regular />
															{resolved ? "Reopen" : "Resolve"}
														</Button>
													) : null}
												</Flex>
												{replyTo === comment.id ? (
													<Flex direction="column" gap="1" mt="1">
														<TextArea
															rows={2}
															value={replyText}
															placeholder={`Reply to ${comment.authorName}`}
															onChange={(event) =>
																setReplyText(event.currentTarget.value)
															}
														/>
														<Flex justify="end" gap="1">
															<Button
																size="1"
																variant="soft"
																color="gray"
																onClick={() => setReplyTo(null)}
															>
																Cancel
															</Button>
															<Button
																size="1"
																disabled={!canComment || !replyText.trim()}
																onClick={() =>
																	send(
																		thread.lineId,
																		thread.wordId,
																		comment.id,
																	)
																}
															>
																Send reply
															</Button>
														</Flex>
													</Flex>
												) : null}
											</div>
										);
									})}
								</Box>
								<Tooltip content={resolved ? "Reopen thread" : "Resolve thread"}>
									<Button
										size="1"
										variant="ghost"
										color={resolved ? "gray" : "green"}
										onClick={() =>
											collabClient.comment("resolve", {
												commentId: root.id,
												resolved: !resolved,
											})
										}
										aria-label={resolved ? "Reopen thread" : "Resolve thread"}
									>
										<Checkmark16Regular />
									</Button>
								</Tooltip>
							</div>
						);
					})}
				</div>
			</PaneSection>
		</Drawer>
	);
}
