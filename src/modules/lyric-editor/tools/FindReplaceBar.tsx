import {
	ArrowDown16Regular,
	ArrowUp16Regular,
	ChevronDown16Regular,
	ChevronRight16Regular,
	Dismiss16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Button,
	Checkbox,
	Dialog,
	DropdownMenu,
	TextField,
} from "@radix-ui/themes";
import classNames from "classnames";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { collabLocksAtom, collabSelfIdAtom } from "$/modules/collab/states";
import { findReplaceStateAtom } from "$/states/dialogs";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	findMatches,
	replaceAllMatches,
	replaceCurrentMatch,
	type SearchScope,
} from "../utils/find-replace";
import styles from "./find-replace.module.css";

export const FindReplaceBar: FC = () => {
	const { t } = useTranslation();
	const [state, setState] = useAtom(findReplaceStateAtom);
	const lyricData = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [selectedLineIds, setSelectedLines] = useAtom(selectedLinesAtom);
	const [selectedWordIds, setSelectedWords] = useAtom(selectedWordsAtom);
	const locks = useAtomValue(collabLocksAtom);
	const selfId = useAtomValue(collabSelfIdAtom);
	const [previewOpen, setPreviewOpen] = useState(false);

	const lockedLineIds = useMemo(() => {
		const now = Date.now();
		return new Set(
			locks
				.filter(
					(lock) =>
						lock.expiresAt > now && (!selfId || lock.clientId !== selfId),
				)
				.map((lock) => lock.lineId),
		);
	}, [locks, selfId]);

	const findInputRef = useRef<HTMLInputElement>(null);
	const replaceInputRef = useRef<HTMLInputElement>(null);

	// Only make selection changes invalidate matches when selection-only is active.
	// Otherwise highlighting a match would recompute matches and re-highlight it
	// forever, eventually tripping React's maximum update depth guard.
	const searchLineIds = state.selectionOnly ? selectedLineIds : undefined;

	const allMatches = useMemo(() => {
		if (!state.open || !state.query) return [];
		return findMatches(lyricData, {
			query: state.query,
			replacement: state.replaceText,
			matchCase: state.matchCase,
			wholeWord: state.wholeWord,
			useRegex: state.useRegex,
			scope: state.scope,
			lineIds: searchLineIds,
		});
	}, [
		state.open,
		state.query,
		state.replaceText,
		state.matchCase,
		state.wholeWord,
		state.useRegex,
		state.scope,
		searchLineIds,
		lyricData,
	]);

	const matches = useMemo(
		() => allMatches.filter((match) => !lockedLineIds.has(match.lineId)),
		[allMatches, lockedLineIds],
	);

	const activeIndex = useMemo(() => {
		if (matches.length === 0) return -1;
		if (state.activeMatchIndex >= matches.length) {
			return 0;
		}
		if (state.activeMatchIndex < 0) {
			return 0;
		}
		return state.activeMatchIndex;
	}, [matches.length, state.activeMatchIndex]);

	const highlightMatch = useCallback(
		(index: number) => {
			if (index < 0 || index >= matches.length) return;
			const match = matches[index];
			if (!match) return;

			// In selection-only mode the result line is already part of the search
			// scope. Keep the user's multi-line selection instead of replacing it
			// with the single result line.
			if (
				!state.selectionOnly &&
				(selectedLineIds.size !== 1 || !selectedLineIds.has(match.lineId))
			) {
				setSelectedLines(new Set([match.lineId]));
			}

			if (match.wordId) {
				if (selectedWordIds.size !== 1 || !selectedWordIds.has(match.wordId)) {
					setSelectedWords(new Set([match.wordId]));
				}
			} else if (selectedWordIds.size > 0) {
				setSelectedWords(new Set());
			}
		},
		[
			matches,
			selectedLineIds,
			selectedWordIds,
			state.selectionOnly,
			setSelectedLines,
			setSelectedWords,
		],
	);

	const goToNext = useCallback(() => {
		if (matches.length === 0) return;
		const nextIndex = (activeIndex + 1) % matches.length;
		setState((prev) => ({ ...prev, activeMatchIndex: nextIndex }));
		highlightMatch(nextIndex);
	}, [activeIndex, matches.length, highlightMatch, setState]);

	const goToPrev = useCallback(() => {
		if (matches.length === 0) return;
		const prevIndex = (activeIndex - 1 + matches.length) % matches.length;
		setState((prev) => ({ ...prev, activeMatchIndex: prevIndex }));
		highlightMatch(prevIndex);
	}, [activeIndex, matches.length, highlightMatch, setState]);

	useEffect(() => {
		if (state.open && matches.length > 0 && activeIndex >= 0) {
			highlightMatch(activeIndex);
		}
	}, [state.open, activeIndex, matches.length, highlightMatch]);

	const wasOpenRef = useRef(false);
	const lastFocusTriggerRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (!state.open) {
			wasOpenRef.current = false;
			return;
		}

		const justOpened = !wasOpenRef.current;
		wasOpenRef.current = true;

		const isNewTrigger =
			state.focusTrigger !== undefined &&
			state.focusTrigger !== lastFocusTriggerRef.current;
		lastFocusTriggerRef.current = state.focusTrigger;

		if (justOpened || isNewTrigger) {
			requestAnimationFrame(() => {
				const shouldFocusReplace =
					state.focusTarget === "replace" ||
					(!state.focusTarget && state.replaceMode && state.query);

				if (shouldFocusReplace && replaceInputRef.current) {
					replaceInputRef.current.focus();
					replaceInputRef.current.select();
				} else if (findInputRef.current) {
					findInputRef.current.focus();
					findInputRef.current.select();
				}
			});
		}
	}, [
		state.open,
		state.focusTrigger,
		state.focusTarget,
		state.replaceMode,
		state.query,
	]);

	const handleClose = useCallback(() => {
		setState((prev) => ({ ...prev, open: false }));
	}, [setState]);

	const handleReplaceOne = useCallback(() => {
		if (activeIndex < 0 || activeIndex >= matches.length) return;
		const match = matches[activeIndex];
		if (!match) return;

		editLyricLines((draft) => {
			const { nextLyrics, modified } = replaceCurrentMatch(
				draft,
				match,
				state.replaceText,
			);
			if (modified) {
				draft.lyricLines = nextLyrics.lyricLines;
			}
		});

		// Keep the same index: the next match shifts into this slot after the
		// current occurrence is removed, so advancing here would skip it.
	}, [activeIndex, matches, editLyricLines, state.replaceText]);

	const applyReplaceAll = useCallback(() => {
		if (!state.query) return;

		editLyricLines((draft) => {
			const { nextLyrics, replacedCount, linesAffected, skippedLines } =
				replaceAllMatches(draft, {
					query: state.query,
					replacement: state.replaceText,
					matchCase: state.matchCase,
					wholeWord: state.wholeWord,
					useRegex: state.useRegex,
					scope: state.scope,
					lineIds: state.selectionOnly ? selectedLineIds : undefined,
					skipLineIds: lockedLineIds,
				});

			if (replacedCount > 0) {
				draft.lyricLines = nextLyrics.lyricLines;
				toast.success(
					t(
						"findReplace.replacedSummary",
						"Replaced {count} occurrences across {lines} lines",
						{
							count: replacedCount,
							lines: linesAffected,
						},
					) +
						(skippedLines
							? ` ${skippedLines} locked or claimed line${skippedLines === 1 ? "" : "s"} skipped.`
							: ""),
				);
			} else {
				toast.info(t("findReplace.noMatches", "No matches found"));
			}
		});
	}, [
		state.query,
		state.replaceText,
		state.matchCase,
		state.wholeWord,
		state.useRegex,
		state.scope,
		state.selectionOnly,
		selectedLineIds,
		lockedLineIds,
		editLyricLines,
		t,
	]);

	const handleReplaceAll = useCallback(() => {
		if (!state.query || matches.length === 0) return;
		setPreviewOpen(true);
	}, [state.query, matches.length]);

	if (!state.open) return null;

	const scopeLabels: Record<SearchScope, string> = {
		all: t("findReplace.scope.all", "All Fields"),
		lyrics: t("findReplace.scope.lyrics", "Main Lyrics"),
		translations: t("findReplace.scope.translations", "Translations"),
		romanizations: t("findReplace.scope.romanizations", "Romanizations"),
	};

	return (
		<div className={styles.findReplacePanel}>
			{/* Row 1: Find Row */}
			<div className={styles.row}>
				<button
					type="button"
					className={styles.iconBtn}
					title={
						state.replaceMode
							? t("findReplace.collapseReplace", "Hide Replace")
							: t("findReplace.expandReplace", "Show Replace")
					}
					onClick={() =>
						setState((prev) => ({ ...prev, replaceMode: !prev.replaceMode }))
					}
				>
					{state.replaceMode ? (
						<ChevronDown16Regular />
					) : (
						<ChevronRight16Regular />
					)}
				</button>

				<div className={styles.inputWrapper}>
					<TextField.Root
						ref={findInputRef}
						size="1"
						value={state.query}
						onChange={(e) =>
							setState((prev) => ({
								...prev,
								query: e.target.value,
								activeMatchIndex: 0,
							}))
						}
						placeholder={t("findReplace.findPlaceholder", "Find...")}
						style={{ width: "100%" }}
						onKeyDown={(e) => {
							if (
								e.key === "Tab" &&
								!e.shiftKey &&
								state.replaceMode &&
								replaceInputRef.current
							) {
								e.preventDefault();
								replaceInputRef.current.focus();
								replaceInputRef.current.select();
							} else if (e.key === "Enter") {
								e.preventDefault();
								if (e.shiftKey) {
									goToPrev();
								} else {
									goToNext();
								}
							} else if (e.key === "Escape") {
								e.preventDefault();
								handleClose();
							}
						}}
					>
						<TextField.Slot>
							<Search16Regular style={{ color: "var(--gray-9)" }} />
						</TextField.Slot>
						{state.query && (
							<TextField.Slot side="right">
								<span
									className={classNames(
										styles.matchCount,
										matches.length === 0 && styles.matchCountNone,
									)}
								>
									{matches.length === 0
										? t("findReplace.noResults", "No results")
										: `${activeIndex + 1} of ${matches.length}`}
								</span>
							</TextField.Slot>
						)}
					</TextField.Root>
				</div>

				{/* Match Options Toggles */}
				<button
					type="button"
					className={classNames(
						styles.toggleBtn,
						state.matchCase && styles.toggleBtnActive,
					)}
					title={t("findReplace.matchCase", "Match Case (Aa)")}
					onClick={() =>
						setState((prev) => ({
							...prev,
							matchCase: !prev.matchCase,
							activeMatchIndex: 0,
						}))
					}
				>
					Aa
				</button>

				<button
					type="button"
					className={classNames(
						styles.toggleBtn,
						state.wholeWord && styles.toggleBtnActive,
					)}
					title={t("findReplace.matchWholeWord", "Match Whole Word (\\b)")}
					onClick={() =>
						setState((prev) => ({
							...prev,
							wholeWord: !prev.wholeWord,
							activeMatchIndex: 0,
						}))
					}
				>
					\b
				</button>

				<button
					type="button"
					className={classNames(
						styles.toggleBtn,
						state.useRegex && styles.toggleBtnActive,
					)}
					title={t("findReplace.useRegex", "Use Regular Expression (.*)")}
					onClick={() =>
						setState((prev) => ({
							...prev,
							useRegex: !prev.useRegex,
							activeMatchIndex: 0,
						}))
					}
				>
					.*
				</button>

				{/* Navigation buttons */}
				<button
					type="button"
					className={styles.iconBtn}
					disabled={matches.length === 0}
					title={t("findReplace.prevMatch", "Previous Match (Shift+Enter)")}
					onClick={goToPrev}
				>
					<ArrowUp16Regular />
				</button>

				<button
					type="button"
					className={styles.iconBtn}
					disabled={matches.length === 0}
					title={t("findReplace.nextMatch", "Next Match (Enter)")}
					onClick={goToNext}
				>
					<ArrowDown16Regular />
				</button>

				{/* Close Button */}
				<button
					type="button"
					className={styles.iconBtn}
					title={t("common.close", "Close (Esc)")}
					onClick={handleClose}
				>
					<Dismiss16Regular />
				</button>
			</div>

			{/* Row 2: Replace Row (collapsible) */}
			{state.replaceMode && (
				<div className={styles.row} style={{ marginTop: 2 }}>
					<div style={{ width: 26, flexShrink: 0 }} />

					<div className={styles.inputWrapper}>
						<TextField.Root
							ref={replaceInputRef}
							size="1"
							value={state.replaceText}
							onChange={(e) =>
								setState((prev) => ({
									...prev,
									replaceText: e.target.value,
								}))
							}
							placeholder={t("findReplace.replacePlaceholder", "Replace...")}
							style={{ width: "100%" }}
							onKeyDown={(e) => {
								if (e.key === "Tab" && e.shiftKey && findInputRef.current) {
									e.preventDefault();
									findInputRef.current.focus();
									findInputRef.current.select();
								} else if (e.key === "Enter") {
									e.preventDefault();
									if (e.shiftKey || e.altKey) {
										handleReplaceAll();
									} else {
										handleReplaceOne();
									}
								} else if (e.key === "Escape") {
									e.preventDefault();
									handleClose();
								}
							}}
						/>
					</div>

					{/* Scope selector dropdown */}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button
								variant="surface"
								size="1"
								color="gray"
								style={{ fontSize: 11, cursor: "pointer" }}
							>
								{scopeLabels[state.scope]}
								<DropdownMenu.TriggerIcon />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content size="1">
							<DropdownMenu.RadioGroup
								value={state.scope}
								onValueChange={(v) =>
									setState((prev) => ({
										...prev,
										scope: v as SearchScope,
										activeMatchIndex: 0,
									}))
								}
							>
								<DropdownMenu.RadioItem value="all">
									{scopeLabels.all}
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="lyrics">
									{scopeLabels.lyrics}
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="translations">
									{scopeLabels.translations}
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="romanizations">
									{scopeLabels.romanizations}
								</DropdownMenu.RadioItem>
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					<label
						style={{
							display: "flex",
							alignItems: "center",
							gap: 4,
							fontSize: 11,
							whiteSpace: "nowrap",
						}}
						title="Only search and replace inside selected lines"
					>
						<Checkbox
							checked={Boolean(state.selectionOnly)}
							onCheckedChange={(value) =>
								setState((prev) => ({
									...prev,
									selectionOnly: value === true,
									activeMatchIndex: 0,
								}))
							}
						/>
						Selection only
					</label>

					{/* Actions */}
					<div className={styles.replaceActions}>
						<Button
							variant="soft"
							size="1"
							disabled={matches.length === 0}
							onClick={handleReplaceOne}
							title={t("findReplace.replaceOne", "Replace (Enter)")}
							style={{ cursor: "pointer" }}
						>
							{t("findReplace.replace", "Replace")}
						</Button>
						<Button
							variant="solid"
							size="1"
							disabled={matches.length === 0}
							onClick={handleReplaceAll}
							title={t("findReplace.replaceAll", "Replace All")}
							style={{ cursor: "pointer" }}
						>
							{t("findReplace.replaceAll", "Replace All")}
						</Button>
					</div>
				</div>
			)}

			{state.query && matches.length > 0 && (
				<div
					style={{
						marginTop: 4,
						maxHeight: 132,
						overflowY: "auto",
						borderTop: "1px solid var(--gray-a4)",
						paddingTop: 4,
						fontSize: 11,
					}}
				>
					{matches.slice(0, 40).map((match, index) => (
						<button
							key={match.id}
							type="button"
							onClick={() => {
								setState((prev) => ({
									...prev,
									activeMatchIndex: index,
								}));
								highlightMatch(index);
							}}
							style={{
								display: "flex",
								gap: 6,
								width: "100%",
								textAlign: "left",
								border: "none",
								background:
									index === activeIndex ? "var(--accent-a3)" : "transparent",
								color: "inherit",
								cursor: "pointer",
								padding: "2px 4px",
								borderRadius: 4,
							}}
						>
							<span style={{ opacity: 0.6, minWidth: 26 }}>
								L{match.lineIndex + 1}
							</span>
							<span style={{ fontWeight: 600 }}>{match.matchText}</span>
							<span
								style={{
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									opacity: 0.7,
								}}
							>
								{match.preview}
							</span>
						</button>
					))}
					{allMatches.length > matches.length ? (
						<div style={{ opacity: 0.65, padding: "2px 4px" }}>
							{allMatches.length - matches.length} match(es) on locked or
							claimed lines are skipped.
						</div>
					) : null}
				</div>
			)}

			<Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
				<Dialog.Content maxWidth="560px">
					<Dialog.Title>Preview replace all</Dialog.Title>
					<Dialog.Description size="1" color="gray">
						{matches.length} match{matches.length === 1 ? "" : "es"} will be
						replaced with "{state.replaceText}". Timing is not changed. This is
						one undo step and one batched room operation.
						{lockedLineIds.size
							? " Lines locked or claimed by someone else are skipped."
							: ""}
					</Dialog.Description>
					<div
						style={{
							maxHeight: 240,
							overflowY: "auto",
							marginTop: 12,
							fontSize: 12,
						}}
					>
						{matches.slice(0, 80).map((match) => (
							<div
								key={match.id}
								style={{
									padding: "4px 6px",
									borderBottom: "1px solid var(--gray-a4)",
								}}
							>
								<span style={{ opacity: 0.6 }}>Line {match.lineIndex + 1}</span>{" "}
								<span style={{ fontWeight: 600 }}>{match.matchText}</span>{" "}
								<span style={{ opacity: 0.7 }}>{match.preview}</span>
							</div>
						))}
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							gap: 8,
							marginTop: 16,
						}}
					>
						<Dialog.Close>
							<Button variant="soft" color="gray">
								Cancel
							</Button>
						</Dialog.Close>
						<Button
							onClick={() => {
								applyReplaceAll();
								setPreviewOpen(false);
							}}
						>
							Replace {matches.length}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</div>
	);
};
