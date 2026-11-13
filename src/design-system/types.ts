/**
 * Shared types for the New interface design system.
 *
 * These values are persisted independently of Classic so switching interface
 * layers never changes the existing editor, timing, or collaboration state.
 */

export enum Density {
	Comfortable = "comfortable",
	Compact = "compact",
}

export enum ContrastMode {
	Standard = "standard",
	High = "high",
}

export enum PerformanceMode {
	Off = "off",
	Auto = "auto",
	On = "on",
}

export type ThemeMode = "dark" | "light" | "system";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type BadgeTone =
	| "neutral"
	| "accent"
	| "success"
	| "warning"
	| "danger"
	| "info";

export type DialogSize = "small" | "medium" | "large";

export type DrawerSide = "left" | "right";

export type MenuSide = "top" | "right" | "bottom" | "left";

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export const SPACING_TOKENS = [4, 8, 12, 16, 24, 32] as const;
export type SpacingToken = (typeof SPACING_TOKENS)[number];

export const TYPE_SCALE = [12, 13, 14, 16, 20, 24] as const;
export type TypeScaleToken = (typeof TYPE_SCALE)[number];

export const RADIUS_TOKENS = ["sm", "md", "lg", "full"] as const;
export type RadiusToken = (typeof RADIUS_TOKENS)[number];

export const MOTION_TOKENS = [100, 150, 200] as const;
export type MotionToken = (typeof MOTION_TOKENS)[number];
