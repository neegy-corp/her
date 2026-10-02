CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`message` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `burn_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`kind` text NOT NULL,
	`character` text,
	`amount` text NOT NULL,
	`raw_amount` text NOT NULL,
	`mint` text NOT NULL,
	`decimals` integer NOT NULL,
	`program` text NOT NULL,
	`name` text NOT NULL,
	`topic` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`host` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `burn_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`kind` text NOT NULL,
	`character` text,
	`amount` text NOT NULL,
	`signature` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_burn_signature` ON `burn_receipts` (`signature`);--> statement-breakpoint
CREATE INDEX `burn_wallet` ON `burn_receipts` (`wallet`);--> statement-breakpoint
CREATE TABLE `stage_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`name` text NOT NULL,
	`topic` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`invite_url` text,
	`stage_slot` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_on_stage_guest` ON `stage_requests` (`stage_slot`) WHERE "stage_requests"."status" = 'on_stage';--> statement-breakpoint
CREATE INDEX `stage_status` ON `stage_requests` (`status`);--> statement-breakpoint
CREATE TABLE `wallet_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`expires` integer NOT NULL
);
