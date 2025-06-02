CREATE TABLE "game_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"session_name" text DEFAULT 'Main Game',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"game_state" jsonb NOT NULL,
	"auto_save" boolean DEFAULT true NOT NULL,
	"save_name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"display_name" text,
	"run_ts" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE no action ON UPDATE no action;