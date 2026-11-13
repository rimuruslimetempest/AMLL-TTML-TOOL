import {
	Avatar as RadixAvatar,
	Badge as RadixBadge,
	Button as RadixButton,
	Card as RadixCard,
	Checkbox as RadixCheckbox,
	IconButton as RadixIconButton,
	Kbd as RadixKbd,
	Progress as RadixProgress,
	RadioGroup as RadixRadioGroup,
	SegmentedControl as RadixSegmentedControl,
	Select as RadixSelect,
	Slider as RadixSlider,
	Spinner as RadixSpinner,
	Switch as RadixSwitch,
	Tabs as RadixTabs,
	TextField as RadixTextField,
} from "@radix-ui/themes";
import classNames from "classnames";
import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";
import styles from "./design-system.module.css";
import type { BadgeTone, ButtonVariant, SelectOption } from "./types";

type RadixButtonProps = ComponentPropsWithoutRef<typeof RadixButton>;
type RadixIconButtonProps = ComponentPropsWithoutRef<typeof RadixIconButton>;
type RadixSwitchProps = ComponentPropsWithoutRef<typeof RadixSwitch>;
type RadixCheckboxProps = ComponentPropsWithoutRef<typeof RadixCheckbox>;
type RadixTextFieldProps = ComponentPropsWithoutRef<typeof RadixTextField.Root>;
type RadixSliderProps = ComponentPropsWithoutRef<typeof RadixSlider>;
type RadixCardProps = ComponentPropsWithoutRef<typeof RadixCard>;
type RadixBadgeProps = ComponentPropsWithoutRef<typeof RadixBadge>;
type RadixAvatarProps = ComponentPropsWithoutRef<typeof RadixAvatar>;
type RadixKbdProps = ComponentPropsWithoutRef<typeof RadixKbd>;
type RadixSpinnerProps = ComponentPropsWithoutRef<typeof RadixSpinner>;
type RadixProgressProps = ComponentPropsWithoutRef<typeof RadixProgress>;
type RadixRadioGroupRootProps = ComponentPropsWithoutRef<
	typeof RadixRadioGroup.Root
>;
type RadixRadioGroupItemProps = ComponentPropsWithoutRef<
	typeof RadixRadioGroup.Item
>;
type RadixSegmentedRootProps = ComponentPropsWithoutRef<
	typeof RadixSegmentedControl.Root
>;
type RadixSegmentedItemProps = ComponentPropsWithoutRef<
	typeof RadixSegmentedControl.Item
>;
type RadixTabsRootProps = ComponentPropsWithoutRef<typeof RadixTabs.Root>;
type RadixTabsListProps = ComponentPropsWithoutRef<typeof RadixTabs.List>;
type RadixTabsTriggerProps = ComponentPropsWithoutRef<typeof RadixTabs.Trigger>;
type RadixTabsContentProps = ComponentPropsWithoutRef<typeof RadixTabs.Content>;

export interface ButtonProps
	extends Omit<RadixButtonProps, "variant" | "color"> {
	variant?: ButtonVariant;
}

export function Button({
	variant = "secondary",
	className,
	...props
}: ButtonProps) {
	const radixVariant =
		variant === "primary"
			? "solid"
			: variant === "ghost"
				? "ghost"
				: variant === "danger"
					? "soft"
					: "soft";

	return (
		<RadixButton
			{...props}
			variant={radixVariant}
			color={variant === "danger" ? "red" : undefined}
			className={classNames(styles.button, styles[variant], className)}
		/>
	);
}

export interface IconButtonProps extends RadixIconButtonProps {
	label: string;
}

export function IconButton({ label, className, ...props }: IconButtonProps) {
	return (
		<RadixIconButton
			{...props}
			aria-label={label}
			title={label}
			className={classNames(styles.iconButton, className)}
		/>
	);
}

export interface ToggleProps extends Omit<RadixSwitchProps, "id"> {
	label: ReactNode;
	hint?: ReactNode;
	id?: string;
}

export function Toggle({ label, hint, id, ...props }: ToggleProps) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	const hintId = hint ? `${fieldId}-hint` : undefined;

	return (
		<div className={styles.toggleRow}>
			<RadixSwitch {...props} id={fieldId} aria-describedby={hintId} />
			<label className={styles.toggleText} htmlFor={fieldId}>
				<span className={styles.toggleLabel}>{label}</span>
				{hint ? (
					<span className={styles.toggleHint} id={hintId}>
						{hint}
					</span>
				) : null}
			</label>
		</div>
	);
}

export interface CheckboxFieldProps
	extends Omit<RadixCheckboxProps, "id" | "children"> {
	label: ReactNode;
	hint?: ReactNode;
	id?: string;
}

export function CheckboxField({
	label,
	hint,
	id,
	...props
}: CheckboxFieldProps) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;

	return (
		<div className={styles.checkboxRow}>
			<RadixCheckbox {...props} id={fieldId} />
			<label className={styles.checkboxText} htmlFor={fieldId}>
				<span className={styles.checkboxLabel}>{label}</span>
				{hint ? <span className={styles.checkboxHint}>{hint}</span> : null}
			</label>
		</div>
	);
}

export interface RadioFieldProps
	extends Omit<RadixRadioGroupItemProps, "value" | "children"> {
	value: string;
	label: ReactNode;
	hint?: ReactNode;
}

export function RadioField({ value, label, hint, ...props }: RadioFieldProps) {
	const generatedId = useId();

	return (
		<div className={styles.radioRow}>
			<RadixRadioGroup.Item {...props} value={value} id={generatedId} />
			<label className={styles.checkboxText} htmlFor={generatedId}>
				<span className={styles.checkboxLabel}>{label}</span>
				{hint ? <span className={styles.checkboxHint}>{hint}</span> : null}
			</label>
		</div>
	);
}

const RadioGroupRoot = ({ className, ...props }: RadixRadioGroupRootProps) => (
	<RadixRadioGroup.Root
		{...props}
		className={classNames(styles.radioGroup, className)}
	/>
);

export const RadioGroup = {
	Root: RadioGroupRoot,
	Item: RadixRadioGroup.Item,
};

const SegmentedRoot = ({ className, ...props }: RadixSegmentedRootProps) => (
	<RadixSegmentedControl.Root
		{...props}
		className={classNames(styles.segmentedRoot, className)}
	/>
);

const SegmentedItem = ({ className, ...props }: RadixSegmentedItemProps) => (
	<RadixSegmentedControl.Item
		{...props}
		className={classNames(styles.segmentedItem, className)}
	/>
);

export const Segmented = {
	Root: SegmentedRoot,
	Item: SegmentedItem,
};

export interface TextInputProps extends RadixTextFieldProps {
	label?: ReactNode;
	hint?: ReactNode;
	error?: ReactNode;
}

export function TextInput({
	label,
	hint,
	error,
	className,
	id,
	...props
}: TextInputProps) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	const hintId = hint ? `${fieldId}-hint` : undefined;
	const errorId = error ? `${fieldId}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	return (
		<div className={styles.field}>
			{label ? (
				<label className={styles.fieldLabel} htmlFor={fieldId}>
					{label}
				</label>
			) : null}
			<RadixTextField.Root
				{...props}
				id={fieldId}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={classNames(styles.input, className)}
			/>
			{hint && !error ? (
				<span className={styles.fieldHint} id={hintId}>
					{hint}
				</span>
			) : null}
			{error ? (
				<span className={styles.fieldError} id={errorId} role="alert">
					{error}
				</span>
			) : null}
		</div>
	);
}

export interface NumberInputProps extends TextInputProps {
	unit?: ReactNode;
}

export function NumberInput({ unit, ...props }: NumberInputProps) {
	const input = <TextInput {...props} type="number" />;

	if (!unit) return input;

	return (
		<div className={styles.inputWithUnit}>
			{input}
			<span className={styles.unit}>{unit}</span>
		</div>
	);
}

export interface SliderFieldProps extends RadixSliderProps {
	label?: ReactNode;
	valueLabel?: ReactNode;
}

export function SliderField({
	label,
	valueLabel,
	className,
	...props
}: SliderFieldProps) {
	return (
		<div className={styles.field}>
			{label || valueLabel ? (
				<div className={styles.fieldLabel}>
					<span>{label}</span>
					{valueLabel ? <span>{valueLabel}</span> : null}
				</div>
			) : null}
			<RadixSlider
				{...props}
				className={classNames(styles.slider, className)}
			/>
		</div>
	);
}

export interface SelectFieldProps {
	label?: ReactNode;
	hint?: ReactNode;
	value: string;
	onValueChange: (value: string) => void;
	options: SelectOption[];
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function SelectField({
	label,
	hint,
	value,
	onValueChange,
	options,
	placeholder,
	disabled,
	className,
}: SelectFieldProps) {
	const generatedId = useId();
	const labelId = label ? `${generatedId}-label` : undefined;

	return (
		<div className={styles.field}>
			{label ? (
				<span className={styles.fieldLabel} id={labelId}>
					{label}
				</span>
			) : null}
			<RadixSelect.Root
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
			>
				<RadixSelect.Trigger
					aria-labelledby={labelId}
					placeholder={placeholder}
					className={classNames(styles.selectTrigger, className)}
				/>
				<RadixSelect.Content position="popper" sideOffset={6}>
					{options.map((option) => (
						<RadixSelect.Item
							key={option.value}
							value={option.value}
							disabled={option.disabled}
						>
							{option.label}
						</RadixSelect.Item>
					))}
				</RadixSelect.Content>
			</RadixSelect.Root>
			{hint ? <span className={styles.fieldHint}>{hint}</span> : null}
		</div>
	);
}

const TabsRoot = ({ className, ...props }: RadixTabsRootProps) => (
	<RadixTabs.Root
		{...props}
		className={classNames(styles.tabsRoot, className)}
	/>
);

const TabsList = ({ className, ...props }: RadixTabsListProps) => (
	<RadixTabs.List
		{...props}
		className={classNames(styles.tabsList, className)}
	/>
);

const TabsTrigger = ({ className, ...props }: RadixTabsTriggerProps) => (
	<RadixTabs.Trigger
		{...props}
		className={classNames(styles.tabsTrigger, className)}
	/>
);

const TabsContent = ({ className, ...props }: RadixTabsContentProps) => (
	<RadixTabs.Content
		{...props}
		className={classNames(styles.tabsContent, className)}
	/>
);

export const Tabs = {
	Root: TabsRoot,
	List: TabsList,
	Trigger: TabsTrigger,
	Content: TabsContent,
};

export interface CardProps extends RadixCardProps {}

export function Card({ className, ...props }: CardProps) {
	return (
		<RadixCard {...props} className={classNames(styles.card, className)} />
	);
}

export interface BadgeProps extends Omit<RadixBadgeProps, "color"> {
	tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
	return (
		<RadixBadge
			{...props}
			className={classNames(
				styles.badge,
				styles[`badge${tone[0].toUpperCase()}${tone.slice(1)}`],
				className,
			)}
		/>
	);
}

export function Divider({
	className,
	...props
}: ComponentPropsWithoutRef<"hr">) {
	return <hr {...props} className={classNames(styles.divider, className)} />;
}

export interface ProgressProps extends RadixProgressProps {
	label?: ReactNode;
}

export function Progress({ label, className, ...props }: ProgressProps) {
	return (
		<div className={styles.field}>
			{label ? <span className={styles.fieldLabel}>{label}</span> : null}
			<RadixProgress
				{...props}
				className={classNames(styles.progress, className)}
			/>
		</div>
	);
}

export function Spinner({ className, ...props }: RadixSpinnerProps) {
	return (
		<RadixSpinner
			{...props}
			aria-label="Loading"
			className={classNames(styles.spinner, className)}
		/>
	);
}

export interface EmptyStateProps {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export function EmptyState({
	icon,
	title,
	description,
	actions,
}: EmptyStateProps) {
	return (
		<div className={styles.emptyState}>
			{icon ? <div className={styles.emptyStateIcon}>{icon}</div> : null}
			<h2 className={styles.emptyStateTitle}>{title}</h2>
			{description ? (
				<p className={styles.emptyStateDescription}>{description}</p>
			) : null}
			{actions ? (
				<div className={styles.emptyStateActions}>{actions}</div>
			) : null}
		</div>
	);
}

export function Kbd({ className, ...props }: RadixKbdProps) {
	return <RadixKbd {...props} className={classNames(styles.kbd, className)} />;
}

export function Avatar({ className, ...props }: RadixAvatarProps) {
	return (
		<RadixAvatar {...props} className={classNames(styles.avatar, className)} />
	);
}

export function SectionLabel({ children }: { children: ReactNode }) {
	return <div className={styles.sectionLabel}>{children}</div>;
}

export interface ToolbarGroupProps {
	label: ReactNode;
	children: ReactNode;
	className?: string;
}

export function ToolbarGroup({ label, children, className }: ToolbarGroupProps) {
	return (
		<section
			className={classNames(styles.toolbarGroup, className)}
			aria-label={typeof label === "string" ? label : undefined}
		>
			<SectionLabel>{label}</SectionLabel>
			<div className={styles.toolbarGroupBody}>{children}</div>
		</section>
	);
}

export interface TimestampChipProps
	extends ComponentPropsWithoutRef<"span"> {
	tone?: "accent" | "neutral" | "muted";
}

export function TimestampChip({
	tone = "accent",
	className,
	...props
}: TimestampChipProps) {
	return (
		<span
			{...props}
			className={classNames(
				styles.timestampChip,
				tone === "accent"
					? styles.chipAccent
					: tone === "neutral"
						? styles.chipNeutral
						: styles.chipMuted,
				className,
			)}
		/>
	);
}
