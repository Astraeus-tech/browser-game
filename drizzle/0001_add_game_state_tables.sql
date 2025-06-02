-- Add game sessions table
CREATE TABLE IF NOT EXISTS "game_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"session_name" text DEFAULT 'Main Game',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

-- Add game states table
CREATE TABLE IF NOT EXISTS "game_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"player_id" uuid NOT NULL,
	"game_state" jsonb NOT NULL,
	"auto_save" boolean DEFAULT true NOT NULL,
	"save_name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "game_states" ADD CONSTRAINT "game_states_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$; 