import { Dialog, Switch } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { toast } from "react-toastify";
import { uid } from "uid";
import {
	appLayoutOrderAtom,
	vRibbonPositionAtom,
} from "$/modules/settings/states";
import {
	focusModeAtom,
	interfaceDirectionAtom,
	savedWorkspacesAtom,
	workspaceManagerOpenAtom,
	type SavedWorkspace,
} from "$/modules/studio/state";
import styles from "./studio.module.css";

const PANEL_LABELS: Record<string, string> = {
	titlebar: "Title bar",
	ribbonbar: "Toolbar / ribbon",
	editor: "Lyric editor",
	"audio-controls": "Audio transport",
};

export function WorkspaceLayoutsDialog() {
	const [open, setOpen] = useAtom(workspaceManagerOpenAtom);
	const [workspaces, setWorkspaces] = useAtom(savedWorkspacesAtom);
	const [layoutOrder, setLayoutOrder] = useAtom(appLayoutOrderAtom);
	const [ribbonPosition, setRibbonPosition] = useAtom(vRibbonPositionAtom);
	const [focusMode, setFocusMode] = useAtom(focusModeAtom);
	const [direction, setDirection] = useAtom(interfaceDirectionAtom);
	const [name, setName] = useState("");

	const saveCurrent = () => {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.info("Give the workspace a name first.");
			return;
		}
		const next: SavedWorkspace = {
			id: uid(),
			name: trimmed,
			layoutOrder: [...layoutOrder],
			ribbonPosition,
			createdAt: Date.now(),
		};
		setWorkspaces((current) => [
			next,
			...current.filter((item) => item.name !== trimmed),
		]);
		setName("");
		toast.success(`Saved workspace “${trimmed}”.`);
	};

	const apply = (workspace: SavedWorkspace) => {
		if (workspace.layoutOrder.length > 0) {
			setLayoutOrder(workspace.layoutOrder);
		}
		setRibbonPosition(workspace.ribbonPosition);
		toast.success(`Applied “${workspace.name}”.`);
	};

	const move = (id: string, direction: -1 | 1) => {
		const index = layoutOrder.indexOf(id);
		if (index < 0) return;
		const next = [...layoutOrder];
		const target = index + direction;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target], next[index]];
		setLayoutOrder(next);
	};

	if (!open) return null;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="640px">
				<div className={styles.studioHeader}>
					<div>
						<Dialog.Title style={{ margin: 0 }}>Workspaces & focus</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							Save the current panel order and ribbon position as a named
							workspace. Focus mode hides every shell panel except the editor and
							transport.
						</Dialog.Description>
					</div>
					<Dialog.Close>
						<button type="button" className={styles.studioSecondary}>
							Close
						</button>
					</Dialog.Close>
				</div>

				<div className={styles.studioCard} style={{ marginBlock: 10 }}>
					<div className={styles.studioRow}>
						<Switch
							checked={focusMode}
							onCheckedChange={(checked) => {
								setFocusMode(checked);
								if (checked) setOpen(false);
							}}
						/>
						<span style={{ flex: 1 }}>
							<strong>Focus mode</strong>
							<div className={styles.studioMuted}>
								Hide the title bar, ribbon, tabs, and bottom bar. Escape or the
								floating button leaves focus mode.
							</div>
						</span>
						<button
							type="button"
							className={styles.studioPrimary}
							onClick={() => {
								setFocusMode(true);
								setOpen(false);
							}}
						>
							Enter focus
						</button>
					</div>
				</div>

				<div className={styles.studioCard} style={{ marginBlockEnd: 10 }}>
					<div className={styles.studioRow}>
						<span style={{ flex: 1 }}>
							<strong>Interface direction</strong>
							<div className={styles.studioMuted}>
								Automatic follows Arabic, Hebrew, Farsi, and Urdu. Force a
								direction to test logical CSS while the translation is incomplete.
							</div>
						</span>
						<select
							className={styles.studioSelect}
							value={direction}
							onChange={(event) =>
								setDirection(
									event.target.value as "auto" | "ltr" | "rtl",
								)
							}
							aria-label="Interface direction"
						>
							<option value="auto">Automatic</option>
							<option value="ltr">Left to right</option>
							<option value="rtl">Right to left</option>
						</select>
					</div>
				</div>

				<div className={styles.studioCard}>
					<strong>Current layout</strong>
					<div className={styles.studioRow}>
						{layoutOrder.map((id, index) => (
							<span key={id} className={styles.studioBadge}>
								{index + 1}. {PANEL_LABELS[id] ?? id}
								<button
									type="button"
									className={styles.workspaceTabClose}
									onClick={() => move(id, -1)}
									aria-label={`Move ${id} up`}
								>
									↑
								</button>
								<button
									type="button"
									className={styles.workspaceTabClose}
									onClick={() => move(id, 1)}
									aria-label={`Move ${id} down`}
								>
									↓
								</button>
							</span>
						))}
					</div>
					<div className={styles.studioRow}>
						<label className={styles.exportCheck}>
							Ribbon position
							<select
								className={styles.studioSelect}
								value={ribbonPosition}
								onChange={(event) =>
									setRibbonPosition(
										event.target.value as "top" | "bottom" | "left" | "right",
									)
								}
							>
								<option value="top">Top</option>
								<option value="bottom">Bottom</option>
								<option value="left">Left</option>
								<option value="right">Right</option>
							</select>
						</label>
						<input
							className={styles.studioInput}
							style={{ flex: 1 }}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Workspace name (e.g. Album timing)"
						/>
						<button type="button" className={styles.studioPrimary} onClick={saveCurrent}>
							Save workspace
						</button>
					</div>
				</div>

				<div className={styles.studioCard} style={{ marginBlockStart: 10 }}>
					<strong>Saved workspaces</strong>
					{workspaces.length === 0 ? (
						<div className={styles.studioMuted}>
							No saved workspaces yet. Arrange the panels, name the layout, and
							save it.
						</div>
					) : (
						workspaces.map((workspace) => (
							<div key={workspace.id} className={styles.layoutCard}>
								<div style={{ flex: 1, minWidth: 0 }}>
									<strong>{workspace.name}</strong>
									<div className={styles.studioMuted}>
										{workspace.layoutOrder
											.map((id) => PANEL_LABELS[id] ?? id)
											.join(" → ")}{" "}
										· ribbon {workspace.ribbonPosition}
									</div>
								</div>
								<button
									type="button"
									className={styles.studioSecondary}
									onClick={() => apply(workspace)}
								>
									Apply
								</button>
								<button
									type="button"
									className={styles.studioSecondary}
									onClick={() =>
										setWorkspaces((current) =>
											current.filter((item) => item.id !== workspace.id),
										)
									}
								>
									Delete
								</button>
							</div>
						))
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
