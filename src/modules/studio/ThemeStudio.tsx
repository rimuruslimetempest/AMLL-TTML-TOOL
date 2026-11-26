import { Dialog, Switch } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs";
import { BUILTIN_THEMES } from "$/modules/themes/builtins";
import {
	activeThemeAtom,
	themeCatalogAtom,
	themeCssSafeModeAtom,
	themeIdAtom,
	themeSchemeIdAtom,
	userThemesAtom,
} from "$/modules/themes/state";
import {
	installUserTheme,
	loadUserThemes,
	themeToJson,
} from "$/modules/themes/storage";
import { resolveScheme } from "$/modules/themes/tokens";
import {
	DEFAULT_THEME_ID,
	THEME_TOKEN_LABELS,
	type ThemePack,
	type ThemeScheme,
	type ThemeTokenKey,
	type ThemeTokenValues,
} from "$/modules/themes/types";
import { parseTheme, sanitizeThemeId } from "$/modules/themes/validate";
import { themeStudioOpenAtom } from "$/modules/studio/state";
import { saveFile } from "$/utils/fileSystem";
import styles from "./studio.module.css";

const PAIR_KEYS: ThemeTokenKey[] = [
	"bgBase",
	"bgRaised",
	"surface",
	"surface2",
	"text",
	"textSecondary",
	"accent",
	"border",
];

function schemeFor(theme: ThemePack, appearance: "dark" | "light"): ThemeScheme {
	const found = theme.schemes.find((scheme) => scheme.appearance === appearance);
	if (found) return found;
	const fallback = BUILTIN_THEMES[0].schemes.find(
		(scheme) => scheme.appearance === appearance,
	);
	return fallback ?? BUILTIN_THEMES[0].schemes[0];
}

function MiniThemePreview({ scheme }: { scheme: ThemeScheme }) {
	const { tokens } = scheme;
	return (
		<div
			aria-hidden="true"
			style={{
				inlineSize: "100%",
				blockSize: 110,
				borderRadius: 10,
				overflow: "hidden",
				border: `1px solid ${tokens.border}`,
				background: tokens.bgBase,
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				style={{
					blockSize: 22,
					display: "flex",
					alignItems: "center",
					gap: 5,
					paddingInline: 8,
					background: tokens.bgRaised,
					borderBlockEnd: `1px solid ${tokens.border}`,
				}}
			>
				<span
					style={{
						inlineSize: 6,
						blockSize: 6,
						borderRadius: 99,
						background: tokens.accent,
					}}
				/>
				<span
					style={{
						inlineSize: 44,
						blockSize: 4,
						borderRadius: 99,
						background: tokens.textSecondary,
					}}
				/>
			</div>
			<div style={{ display: "flex", flex: 1, minBlockSize: 0 }}>
				<div
					style={{
						inlineSize: 44,
						background: tokens.surface,
						borderInlineEnd: `1px solid ${tokens.border}`,
						padding: 6,
						display: "flex",
						flexDirection: "column",
						gap: 5,
					}}
				>
					{[
						{ key: "accent", token: "accent" },
						{ key: "surfaceA", token: "surface2" },
						{ key: "surfaceB", token: "surface2" },
					].map((entry) => (
						<span
							key={entry.key}
							style={{
								blockSize: 5,
								borderRadius: 99,
								background: tokens[entry.token as ThemeTokenKey],
							}}
						/>
					))}
				</div>
				<div
					style={{
						flex: 1,
						padding: 10,
						display: "flex",
						flexDirection: "column",
						gap: 7,
					}}
				>
					<span
						style={{
							inlineSize: "62%",
							blockSize: 8,
							borderRadius: 3,
							background: tokens.text,
						}}
					/>
					<span
						style={{
							inlineSize: "80%",
							blockSize: 4,
							borderRadius: 99,
							background: tokens.textSecondary,
						}}
					/>
					<span
						style={{
							inlineSize: "50%",
							blockSize: 4,
							borderRadius: 99,
							background: tokens.textMuted,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

function PairColumn({
	appearance,
	tokens,
	onChange,
}: {
	appearance: "dark" | "light";
	tokens: ThemeTokenValues;
	onChange: (key: ThemeTokenKey, value: string) => void;
}) {
	return (
		<div className={styles.pairColumn}>
			<strong style={{ textTransform: "capitalize" }}>{appearance} tokens</strong>
			{PAIR_KEYS.map((key) => (
				<label key={key} className={styles.pairSwatch}>
					<input
						type="color"
						value={/^#[0-9a-f]{6}$/i.test(tokens[key]) ? tokens[key] : "#000000"}
						onChange={(event) => onChange(key, event.target.value)}
						aria-label={`${appearance} ${THEME_TOKEN_LABELS[key]}`}
					/>
					<span style={{ flex: 1 }}>{THEME_TOKEN_LABELS[key]}</span>
					<input
						className={styles.studioInput}
						style={{ maxWidth: 110, minBlockSize: 26 }}
						value={tokens[key]}
						onChange={(event) => onChange(key, event.target.value)}
						aria-label={`${appearance} ${THEME_TOKEN_LABELS[key]} value`}
					/>
				</label>
			))}
		</div>
	);
}

export function ThemePairStudio() {
	const catalog = useAtomValue(themeCatalogAtom);
	const activeTheme = useAtomValue(activeThemeAtom);
	const setUserThemes = useSetAtom(userThemesAtom);
	const setThemeId = useSetAtom(themeIdAtom);
	const setSchemeId = useSetAtom(themeSchemeIdAtom);
	const [baseId, setBaseId] = useState(activeTheme.id);
	const base = useMemo(
		() => catalog.find((theme) => theme.id === baseId) ?? catalog[0],
		[baseId, catalog],
	);
	const [name, setName] = useState(`${activeTheme.name} pair`);
	const [darkTokens, setDarkTokens] = useState<ThemeTokenValues>(() =>
		({ ...schemeFor(base, "dark").tokens }),
	);
	const [lightTokens, setLightTokens] = useState<ThemeTokenValues>(() =>
		({ ...schemeFor(base, "light").tokens }),
	);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setDarkTokens({ ...schemeFor(base, "dark").tokens });
		setLightTokens({ ...schemeFor(base, "light").tokens });
	}, [base]);

	const darkScheme: ThemeScheme = {
		...schemeFor(base, "dark"),
		tokens: darkTokens,
	};
	const lightScheme: ThemeScheme = {
		...schemeFor(base, "light"),
		tokens: lightTokens,
	};

	const save = async () => {
		setSaving(true);
		try {
			const idBase = sanitizeThemeId(name || "custom-pair");
			let id = idBase;
			let index = 2;
			while (catalog.some((theme) => theme.id === id)) {
				id = `${idBase}-${index++}`;
			}
			const next: ThemePack = {
				format: 1,
				id,
				name: name.trim() || "Custom theme pair",
				author: "Rimurulover",
				version: "1.0.0",
				description: `Light/dark pair based on ${base.name}.`,
				schemes: [
					{ ...darkScheme, appearance: "dark" },
					{ ...lightScheme, appearance: "light" },
				],
				...(base.effects ? { effects: base.effects } : {}),
				builtin: false,
			};
			const parsed = parseTheme(themeToJson(next, true), {
				allowBuiltinId: false,
			});
			if (!parsed.ok || !parsed.theme) {
				toast.error(parsed.errors[0] ?? "The theme pair could not be saved.");
				return;
			}
			await installUserTheme(next, "");
			setUserThemes(await loadUserThemes());
			setThemeId(next.id);
			setSchemeId("auto");
			toast.success(`Saved “${next.name}” as a light/dark pair.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			setSaving(false);
		}
	};

	const exportPair = async () => {
		const id = sanitizeThemeId(name || "custom-pair");
		const next: ThemePack = {
			format: 1,
			id,
			name: name.trim() || "Custom theme pair",
			author: "Rimurulover",
			version: "1.0.0",
			description: `Light/dark pair based on ${base.name}.`,
			schemes: [
				{ ...darkScheme, appearance: "dark" },
				{ ...lightScheme, appearance: "light" },
			],
			builtin: false,
		};
		await saveFile(themeToJson(next, true), {
			suggestedName: `${id}.json`,
			types: [
				{ description: "Theme JSON", accept: { "application/json": [".json"] } },
			],
		});
	};

	return (
		<div className={styles.studioCard}>
			<div className={styles.studioRow}>
				<strong style={{ flex: 1 }}>Light/dark pair editor</strong>
				<button type="button" className={styles.studioSecondary} onClick={() => void exportPair()}>
					Export pair
				</button>
				<button
					type="button"
					className={styles.studioPrimary}
					disabled={saving}
					onClick={() => void save()}
				>
					{saving ? "Saving…" : "Save pair"}
				</button>
			</div>
			<div className={styles.studioRow}>
				<label className={styles.exportCheck}>
					Base theme
					<select
						className={styles.studioSelect}
						value={base.id}
						onChange={(event) => setBaseId(event.target.value)}
					>
						{catalog.map((theme) => (
							<option key={theme.id} value={theme.id}>
								{theme.name}
								{theme.builtin ? " (built-in)" : ""}
							</option>
						))}
					</select>
				</label>
				<label className={styles.exportCheck} style={{ flex: 1 }}>
					Name
					<input
						className={styles.studioInput}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</label>
			</div>
			<div className={styles.pairGrid}>
				<PairColumn
					appearance="dark"
					tokens={darkTokens}
					onChange={(key, value) =>
						setDarkTokens((current) => ({ ...current, [key]: value }))
					}
				/>
				<PairColumn
					appearance="light"
					tokens={lightTokens}
					onChange={(key, value) =>
						setLightTokens((current) => ({ ...current, [key]: value }))
					}
				/>
			</div>
			<div className={styles.pairGrid}>
				<div>
					<div className={styles.studioMuted}>Dark preview</div>
					<MiniThemePreview scheme={darkScheme} />
				</div>
				<div>
					<div className={styles.studioMuted}>Light preview</div>
					<MiniThemePreview scheme={lightScheme} />
				</div>
			</div>
			<div className={styles.studioMuted}>
				Saving creates a separate theme pack; the base theme is never changed.
				Custom CSS and remote assets stay in the full theme manager.
			</div>
		</div>
	);
}

export function ThemeStudioDialog() {
	const [open, setOpen] = useAtom(themeStudioOpenAtom);
	const catalog = useAtomValue(themeCatalogAtom);
	const themeId = useAtomValue(themeIdAtom);
	const setThemeId = useSetAtom(themeIdAtom);
	const [safeMode, setSafeMode] = useAtom(themeCssSafeModeAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);

	if (!open) return null;
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.studioDialog}>
				<div className={styles.studioHeader}>
					<div>
						<Dialog.Title style={{ margin: 0 }}>Theme Studio 2.0</Dialog.Title>
						<Dialog.Description size="2" color="gray">
							One home for the gallery, live previews, light/dark pair editing,
							tokens, CSS, and import/export.
						</Dialog.Description>
					</div>
					<div className={styles.studioRow}>
						<button
							type="button"
							className={styles.studioPrimary}
							onClick={() => {
								setSettingsTab("themes");
								setSettingsOpen(true);
								setOpen(false);
							}}
						>
							Full theme manager
						</button>
						<Dialog.Close>
							<button type="button" className={styles.studioSecondary}>
								Close
							</button>
						</Dialog.Close>
					</div>
				</div>
				<div className={styles.studioBody}>
					<div className={styles.studioCard} style={{ marginBlockEnd: 10 }}>
						<div className={styles.studioRow}>
							<Switch checked={safeMode} onCheckedChange={setSafeMode} />
							<span style={{ flex: 1 }}>
								<strong>Theme safe mode</strong>
								<div className={styles.studioMuted}>
									Disable all theme and custom CSS while keeping token colors.
								</div>
							</span>
							<button
								type="button"
								className={styles.studioSecondary}
								onClick={() => setThemeId(DEFAULT_THEME_ID)}
							>
								Reset to default
							</button>
						</div>
					</div>
					<div className={styles.studioGrid}>
						{catalog.map((theme) => {
							const dark = resolveScheme(theme, "auto", true);
							return (
								<button
									key={theme.id}
									type="button"
									className={styles.studioCard}
									style={{
										textAlign: "start",
										cursor: "pointer",
										outline:
											theme.id === themeId
												? "2px solid var(--ttml-accent, var(--accent-9))"
												: undefined,
									}}
									onClick={() => setThemeId(theme.id)}
								>
									<MiniThemePreview scheme={dark} />
									<div className={styles.studioRow}>
										<strong style={{ flex: 1 }}>{theme.name}</strong>
										{theme.id === themeId ? (
											<span className={styles.studioBadge}>Active</span>
										) : null}
									</div>
									<span className={styles.studioMuted}>
										{theme.builtin ? "Built-in" : "Installed"} ·{" "}
										{theme.effects?.level ?? "none"} effects
									</span>
								</button>
							);
						})}
					</div>
					<div style={{ marginBlockStart: 12 }}>
						<ThemePairStudio />
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
