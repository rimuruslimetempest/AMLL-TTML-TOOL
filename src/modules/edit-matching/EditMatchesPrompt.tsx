import {
	Checkmark16Regular,
	Dismiss16Regular,
	Edit16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Checkbox,
	Flex,
	Text,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { askBeforeMatchingWordEditsAtom } from "$/modules/settings/states";
import { lyricLinesAtom } from "$/states/main";
import type { LyricLine, TTMLLyric } from "$/types/ttml";
import {
	collabLocksAtom,
	collabRemoteEditAtAtom,
	collabRoleAtom,
	collabSelfIdAtom,
} from "$/modules/collab/states";
import { can } from "$/modules/collab/permissions";
import { collabClient } from "$/modules/collab/client";
import styles from "$/modules/collab/collab-ui.module.css";

interface WordChange {
	lineId: string;
	wordId: string;
	before: string;
	after: string;
}

interface Candidate {
	lineId: string;
	wordId: string;
	lineText: string;
	lineIndex: number;
}

interface Pending {
	change: WordChange;
	candidates: Candidate[];
	skipped: number;
}

function wordMap(lyrics: TTMLLyric | readonly LyricLine[]) {
	const lines = Array.isArray(lyrics) ? lyrics : (lyrics as TTMLLyric).lyricLines;
	const map = new Map<string, { word: string; lineId: string }>();
	for (const line of lines) {
		for (const word of line.words) {
			map.set(word.id, { word: word.word, lineId: line.id });
		}
	}
	return map;
}

function detectChange(previous: LyricLine[], current: LyricLine[]): WordChange | null {
	const before = wordMap(previous);
	const after = wordMap(current);
	let found: WordChange | null = null;
	for (const [wordId, value] of after) {
		const old = before.get(wordId);
		if (!old) continue;
		if (old.word === value.word) continue;
		if (found) return null;
		found = {
			lineId: value.lineId,
			wordId,
			before: old.word,
			after: value.word,
		};
	}
	return found;
}

export function EditMatchesPrompt() {
	const lyrics = useAtomValue(lyricLinesAtom);
	const locks = useAtomValue(collabLocksAtom);
	const role = useAtomValue(collabRoleAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const ask = useAtomValue(askBeforeMatchingWordEditsAtom);
	const remoteEditAt = useAtomValue(collabRemoteEditAtAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const baseline = useRef<LyricLine[]>(lyrics.lyricLines);
	const applying = useRef(false);
	const [pending, setPending] = useState<Pending | null>(null);
	const [matchCase, setMatchCase] = useState(true);
	const [wholeWord, setWholeWord] = useState(true);
	const [reviewIndex, setReviewIndex] = useState<number | null>(null);
	const [accepted, setAccepted] = useState<Set<string>>(new Set());

	const lockedLines = useMemo(() => {
		const now = Date.now();
		return new Set(
			locks
				.filter(
					(lock) =>
						lock.expiresAt > now &&
						(!selfId || lock.clientId !== selfId),
				)
				.map((lock) => lock.lineId),
		);
	}, [locks, selfId]);

	useEffect(() => {
		const timer = setTimeout(() => {
			const previous = baseline.current;
			baseline.current = lyrics.lyricLines;
			if (applying.current) {
				applying.current = false;
				return;
			}
			if (!ask) return;
			if (Date.now() - remoteEditAt < 1500) return;
			const change = detectChange(previous, lyrics.lyricLines);
			if (!change) return;
			if (!change.before.trim() || !change.after.trim()) return;
			if (change.before === change.after) return;
			const candidates: Candidate[] = [];
			let skipped = 0;
			lyrics.lyricLines.forEach((line, index) => {
				for (const word of line.words) {
					if (word.id === change.wordId) continue;
					if (matchCase ? word.word !== change.before : word.word.toLowerCase() !== change.before.toLowerCase()) {
						continue;
					}
					if (wholeWord && word.word !== change.before && !matchCase) {
						// Whole-word in this model means the whole word chip, so the
						// equality check above is enough.
						continue;
					}
					if (lockedLines.has(line.id)) {
						skipped += 1;
						continue;
					}
					candidates.push({
						lineId: line.id,
						wordId: word.id,
						lineText: line.words.map((item) => item.word).join(""),
						lineIndex: index + 1,
					});
				}
			});
			if (candidates.length === 0) return;
			setPending({ change, candidates, skipped });
			setReviewIndex(null);
			setAccepted(new Set());
		}, 900);
		return () => clearTimeout(timer);
	}, [lyrics, ask, matchCase, wholeWord, lockedLines, remoteEditAt]);

	const applyWords = (wordIds: string[]) => {
		if (wordIds.length === 0) {
			setPending(null);
			setReviewIndex(null);
			setAccepted(new Set());
			return;
		}
		if (role && !can(role, "editLyrics")) {
			collabClient.notify("editLyrics");
			return;
		}
		const ids = new Set(wordIds);
		const next = pending?.change.after ?? "";
		applying.current = true;
		editLyrics((draft) => {
			for (const line of draft.lyricLines) {
				for (const word of line.words) {
					if (!ids.has(word.id)) continue;
					word.word = next;
					// The chip is a timing unit. Changing its text on a multi-word
					// line may need a new split, so surface it for review instead of
					// guessing at timing.
					if (line.words.length > 1) word.needsReview = true;
				}
			}
		});
		toast.success(
			`Updated ${ids.size} matching word${ids.size === 1 ? "" : "s"}. Timing was kept.`,
		);
		setPending(null);
		setReviewIndex(null);
		setAccepted(new Set());
	};

	if (!pending) return null;
	const current =
		reviewIndex !== null ? pending.candidates[reviewIndex] : undefined;

	return (
		<div className={styles.bottomLeftPrompt} role="region" aria-label="Matching word prompt">
			<Flex align="center" justify="between" gap="2">
				<Flex align="center" gap="1">
					<Edit16Regular />
					<Text weight="bold" size="2">
						Use this change everywhere?
					</Text>
				</Flex>
				<Button
					size="1"
					variant="ghost"
					color="gray"
					aria-label="Just this one"
					onClick={() => setPending(null)}
				>
					<Dismiss16Regular />
				</Button>
			</Flex>
			<Text size="1" color="gray" as="p" style={{ margin: "4px 0 8px" }}>
				You changed <strong>{pending.change.before}</strong> to{" "}
				<strong>{pending.change.after}</strong>. Found {pending.candidates.length}{" "}
				more matching word
				{pending.candidates.length === 1 ? "" : "s"}
				{pending.skipped
					? `, skipped ${pending.skipped} on locked or claimed lines`
					: ""}
				.
			</Text>
			<Flex gap="2" wrap="wrap" mb="2">
				<label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
					<Checkbox
						checked={matchCase}
						onCheckedChange={(value) => setMatchCase(value === true)}
					/>
					Match case
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
					<Checkbox
						checked={wholeWord}
						onCheckedChange={(value) => setWholeWord(value === true)}
					/>
					Whole word only
				</label>
			</Flex>
			{reviewIndex !== null && current ? (
				<Box mb="2">
					<Flex align="center" gap="1" wrap="wrap">
						<Badge size="1" variant="soft">
							{pending.candidates.length - (reviewIndex + 1)} left
						</Badge>
						<Text size="1" color="gray">
							Line {current.lineIndex}
						</Text>
					</Flex>
					<Text size="2" as="div" className={styles.threadText} my="1">
						{current.lineText}
					</Text>
					<Flex gap="1" justify="end">
						<Button
							size="1"
							variant="soft"
							color="gray"
							onClick={() => {
								if (reviewIndex + 1 >= pending.candidates.length) {
									applyWords([...accepted]);
								} else {
									setReviewIndex(reviewIndex + 1);
								}
							}}
						>
							Skip
						</Button>
						<Button
							size="1"
							color="green"
							onClick={() => {
								const nextAccepted = new Set(accepted);
								nextAccepted.add(current.wordId);
								setAccepted(nextAccepted);
								if (reviewIndex + 1 >= pending.candidates.length) {
									applyWords([...nextAccepted]);
								} else {
									setReviewIndex(reviewIndex + 1);
								}
							}}
						>
							<Checkmark16Regular /> Apply
						</Button>
					</Flex>
				</Box>
			) : (
				<Flex gap="2" justify="end" wrap="wrap">
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => setPending(null)}
					>
						Just this one
					</Button>
					<Button
						size="1"
						variant="soft"
						onClick={() => {
							setReviewIndex(0);
							setAccepted(new Set());
						}}
					>
						Review each
					</Button>
					<Button
						size="1"
						onClick={() => applyWords(pending.candidates.map((item) => item.wordId))}
					>
						Apply all ({pending.candidates.length})
					</Button>
				</Flex>
			)}
		</div>
	);
}
