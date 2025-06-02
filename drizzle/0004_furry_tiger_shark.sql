CREATE TABLE "active_game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"current_state" jsonb NOT NULL,
	"server_seed" text NOT NULL,
	"action_sequence" integer DEFAULT 0 NOT NULL,
	"last_action_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_year" integer GENERATED ALWAYS AS (((current_state->>'year')::integer)) STORED,
	"current_quarter" integer GENERATED ALWAYS AS (((current_state->>'quarter')::integer)) STORED,
	"game_over_status" text GENERATED ALWAYS AS ((current_state->>'gameOver')) STORED,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "active_game_sessions_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "game_action_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"action_data" jsonb NOT NULL,
	"state_before" jsonb NOT NULL,
	"state_after" jsonb NOT NULL,
	"sequence_number" integer NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_session_sequence" UNIQUE("session_id","sequence_number")
);
--> statement-breakpoint
ALTER TABLE "game_action_history" ADD CONSTRAINT "game_action_history_session_id_active_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."active_game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_active_games_player" ON "active_game_sessions" USING btree ("player_id") WHERE "active_game_sessions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_active_games_lookup" ON "active_game_sessions" USING btree ("id","is_active") WHERE "active_game_sessions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_active_games_year_quarter" ON "active_game_sessions" USING btree ("current_year","current_quarter") WHERE "active_game_sessions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_active_games_last_action" ON "active_game_sessions" USING btree ("last_action_at") WHERE "active_game_sessions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_action_history_session_seq" ON "game_action_history" USING btree ("session_id","sequence_number");--> statement-breakpoint
CREATE INDEX "idx_action_history_player" ON "game_action_history" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_action_history_session" ON "game_action_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_action_history_type" ON "game_action_history" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_action_history_time" ON "game_action_history" USING btree ("processed_at");