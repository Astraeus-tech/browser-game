CREATE TABLE "active_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checkpoint_id" uuid,
	"game_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "active_games_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "game_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"action_data" jsonb NOT NULL,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"game_state" jsonb NOT NULL,
	"checkpoint_type" text NOT NULL,
	"year" integer NOT NULL,
	"quarter" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_actions" ADD CONSTRAINT "game_actions_game_id_active_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."active_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_checkpoints" ADD CONSTRAINT "game_checkpoints_game_id_active_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."active_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "active_games_player_idx" ON "active_games" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "actions_game_seq_idx" ON "game_actions" USING btree ("game_id","sequence_number");--> statement-breakpoint
CREATE INDEX "actions_player_idx" ON "game_actions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "checkpoints_game_idx" ON "game_checkpoints" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "checkpoints_player_idx" ON "game_checkpoints" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "checkpoints_time_idx" ON "game_checkpoints" USING btree ("year","quarter");--> statement-breakpoint
CREATE INDEX "checkpoints_latest_idx" ON "game_checkpoints" USING btree ("game_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scores_score_idx" ON "scores" USING btree ("score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scores_player_score_idx" ON "scores" USING btree ("player_id","score" DESC NULLS LAST);