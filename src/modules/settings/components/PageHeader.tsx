import { Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./settings-components.module.css";

export interface PageHeaderProps {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<div className={styles.pageHeader}>
			<div className={styles.pageHeaderText}>
				<Heading size="6" className={styles.pageTitle}>
					{title}
				</Heading>
				{description ? (
					<Text
						size="2"
						color="gray"
						as="div"
						className={styles.pageDescription}
					>
						{description}
					</Text>
				) : null}
			</div>
			{actions ? <div className={styles.pageActions}>{actions}</div> : null}
		</div>
	);
}
