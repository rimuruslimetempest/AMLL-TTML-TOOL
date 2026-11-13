import {
	ContextMenu as RadixContextMenu,
	Dialog as RadixDialog,
	DropdownMenu as RadixDropdownMenu,
	Popover as RadixPopover,
	Tooltip as RadixTooltip,
} from "@radix-ui/themes";
import classNames from "classnames";
import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";
import { toast as radixToast, Slide, ToastContainer } from "react-toastify";
import styles from "./design-system.module.css";
import { IconButton } from "./primitives";
import type { DialogSize, DrawerSide, MenuSide } from "./types";

type DialogContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content>;
type DropdownContentProps = ComponentPropsWithoutRef<
	typeof RadixDropdownMenu.Content
>;
type DropdownItemProps = ComponentPropsWithoutRef<
	typeof RadixDropdownMenu.Item
>;
type DropdownSeparatorProps = ComponentPropsWithoutRef<
	typeof RadixDropdownMenu.Separator
>;
type ContextContentProps = ComponentPropsWithoutRef<
	typeof RadixContextMenu.Content
>;
type ContextItemProps = ComponentPropsWithoutRef<typeof RadixContextMenu.Item>;
type ContextSeparatorProps = ComponentPropsWithoutRef<
	typeof RadixContextMenu.Separator
>;

export interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	size?: DialogSize;
	className?: string;
	contentProps?: Omit<DialogContentProps, "children" | "className">;
}

export function Dialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	size = "medium",
	className,
	contentProps,
}: DialogProps) {
	const titleId = useId();
	const descriptionId = useId();

	return (
		<RadixDialog.Root open={open} onOpenChange={onOpenChange}>
			<RadixDialog.Content
				{...contentProps}
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				className={classNames(
					styles.dialogContent,
					size === "small" && styles.dialogSmall,
					size === "large" && styles.dialogLarge,
					className,
				)}
			>
				<div className={styles.dialogHeader}>
					<div>
						<RadixDialog.Title className={styles.dialogTitle} id={titleId}>
							{title}
						</RadixDialog.Title>
						<RadixDialog.Description
							className={description ? styles.dialogDescription : styles.srOnly}
							id={descriptionId}
						>
							{description ?? title}
						</RadixDialog.Description>
					</div>
					<RadixDialog.Close asChild>
						<IconButton label="Close dialog" variant="ghost">
							<span aria-hidden="true">×</span>
						</IconButton>
					</RadixDialog.Close>
				</div>
				<div className={styles.dialogBody}>{children}</div>
				{footer ? <div className={styles.dialogFooter}>{footer}</div> : null}
			</RadixDialog.Content>
		</RadixDialog.Root>
	);
}

export interface DrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	side?: DrawerSide;
	className?: string;
}

export function Drawer({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	side = "right",
	className,
}: DrawerProps) {
	const titleId = useId();
	const descriptionId = useId();

	return (
		<RadixDialog.Root open={open} onOpenChange={onOpenChange}>
			<RadixDialog.Content
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				className={classNames(
					styles.drawerContent,
					side === "left" && styles.drawerContentLeft,
					className,
				)}
			>
				<div className={styles.dialogHeader}>
					<div>
						<RadixDialog.Title className={styles.dialogTitle} id={titleId}>
							{title}
						</RadixDialog.Title>
						<RadixDialog.Description
							className={description ? styles.dialogDescription : styles.srOnly}
							id={descriptionId}
						>
							{description ?? title}
						</RadixDialog.Description>
					</div>
					<RadixDialog.Close asChild>
						<IconButton label="Close panel" variant="ghost">
							<span aria-hidden="true">×</span>
						</IconButton>
					</RadixDialog.Close>
				</div>
				<div className={styles.drawerBody}>{children}</div>
				{footer ? <div className={styles.dialogFooter}>{footer}</div> : null}
			</RadixDialog.Content>
		</RadixDialog.Root>
	);
}

function MenuContent({
	className,
	sideOffset = 6,
	...props
}: DropdownContentProps) {
	return (
		<RadixDropdownMenu.Content
			{...props}
			sideOffset={sideOffset}
			className={classNames(styles.menuContent, className)}
		/>
	);
}

function MenuItem({ className, ...props }: DropdownItemProps) {
	return (
		<RadixDropdownMenu.Item
			{...props}
			className={classNames(styles.menuItem, className)}
		/>
	);
}

function MenuSeparator({ className, ...props }: DropdownSeparatorProps) {
	return (
		<RadixDropdownMenu.Separator
			{...props}
			className={classNames(styles.menuSeparator, className)}
		/>
	);
}

export const Menu = {
	Root: RadixDropdownMenu.Root,
	Trigger: RadixDropdownMenu.Trigger,
	Content: MenuContent,
	Label: RadixDropdownMenu.Label,
	Item: MenuItem,
	Group: RadixDropdownMenu.Group,
	RadioGroup: RadixDropdownMenu.RadioGroup,
	RadioItem: RadixDropdownMenu.RadioItem,
	CheckboxItem: RadixDropdownMenu.CheckboxItem,
	Sub: RadixDropdownMenu.Sub,
	SubTrigger: RadixDropdownMenu.SubTrigger,
	SubContent: RadixDropdownMenu.SubContent,
	Separator: MenuSeparator,
};

function ContextContent({ className, ...props }: ContextContentProps) {
	return (
		<RadixContextMenu.Content
			{...props}
			className={classNames(styles.contextMenuContent, className)}
		/>
	);
}

function ContextItem({ className, ...props }: ContextItemProps) {
	return (
		<RadixContextMenu.Item
			{...props}
			className={classNames(styles.contextMenuItem, className)}
		/>
	);
}

function ContextSeparator({ className, ...props }: ContextSeparatorProps) {
	return (
		<RadixContextMenu.Separator
			{...props}
			className={classNames(styles.menuSeparator, className)}
		/>
	);
}

export const ContextMenu = {
	Root: RadixContextMenu.Root,
	Trigger: RadixContextMenu.Trigger,
	Content: ContextContent,
	Label: RadixContextMenu.Label,
	Item: ContextItem,
	Group: RadixContextMenu.Group,
	RadioGroup: RadixContextMenu.RadioGroup,
	RadioItem: RadixContextMenu.RadioItem,
	CheckboxItem: RadixContextMenu.CheckboxItem,
	Sub: RadixContextMenu.Sub,
	SubTrigger: RadixContextMenu.SubTrigger,
	SubContent: RadixContextMenu.SubContent,
	Separator: ContextSeparator,
};

export interface PopoverProps {
	trigger: ReactNode;
	children: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	side?: MenuSide;
	align?: "start" | "center" | "end";
	className?: string;
}

export function Popover({
	trigger,
	children,
	open,
	onOpenChange,
	side = "bottom",
	align = "center",
	className,
}: PopoverProps) {
	return (
		<RadixPopover.Root open={open} onOpenChange={onOpenChange}>
			<RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
			<RadixPopover.Content
				side={side}
				align={align}
				sideOffset={8}
				className={classNames(styles.popoverContent, className)}
			>
				{children}
			</RadixPopover.Content>
		</RadixPopover.Root>
	);
}

export interface TooltipProps {
	children: ReactNode;
	content: ReactNode;
	shortcut?: ReactNode;
	side?: MenuSide;
	delayDuration?: number;
}

export function Tooltip({
	children,
	content,
	shortcut,
	side = "top",
	delayDuration = 350,
}: TooltipProps) {
	return (
		<RadixTooltip
			content={
				<>
					<span>{content}</span>
					{shortcut ? <span className={styles.kbd}>{shortcut}</span> : null}
				</>
			}
			side={side}
			delayDuration={delayDuration}
			className={styles.tooltipContent}
		>
			{children}
		</RadixTooltip>
	);
}

export function ToastViewport({ theme }: { theme: "light" | "dark" }) {
	return (
		<ToastContainer
			theme={theme}
			hideProgressBar
			transition={Slide}
			autoClose={4000}
			toastClassName={styles.toast}
		/>
	);
}

type ToastOptions = Parameters<typeof radixToast.success>[1];

function toastWithStyle(
	type: "success" | "error" | "info" | "warning",
	message: string,
	options?: ToastOptions,
) {
	return radixToast[type](message, {
		...options,
		className: classNames(styles.toast, options?.className),
	});
}

export const notify = {
	success: (message: string, options?: ToastOptions) =>
		toastWithStyle("success", message, options),
	error: (message: string, options?: ToastOptions) =>
		toastWithStyle("error", message, options),
	info: (message: string, options?: ToastOptions) =>
		toastWithStyle("info", message, options),
	warning: (message: string, options?: ToastOptions) =>
		toastWithStyle("warning", message, options),
	dismiss: radixToast.dismiss,
};
