import { Card } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./settings-components.module.css";

export interface SettingsSectionProps {
	id?: string;
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	badge?: ReactNode;
	actions?: ReactNode;
	children?: ReactNode;
}

export function SettingsSection({
	id,
	icon,
	title,
	description,
	badge,
	actions,
	children,
}: SettingsSectionProps) {
	return (
		<Card id={id} className={styles.section}>
			<div className={styles.sectionHeader}>
				{icon ? (
					<span className={styles.sectionIcon} aria-hidden="true">
						{icon}
					</span>
				) : null}
				<div className={styles.sectionHeading}>
					<div className={styles.sectionTitleRow}>
						<span className={styles.sectionTitle}>{title}</span>
						{badge}
					</div>
					{description ? (
						<div className={styles.sectionDescription}>{description}</div>
					) : null}
				</div>
				{actions ? <div className={styles.sectionActions}>{actions}</div> : null}
			</div>
			{children ? <div className={styles.sectionBody}>{children}</div> : null}
		</Card>
	);
}
