import { pgTable, serial, uuid, text, boolean, timestamp, foreignKey, integer, jsonb, index, unique, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const gameSessions = pgTable("game_sessions", {
	id: serial().primaryKey().notNull(),
	playerId: uuid("player_id").notNull(),
	sessionName: text("session_name").default('Main Game'),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const gameStates = pgTable("game_states", {
	id: serial().primaryKey().notNull(),
	sessionId: integer("session_id"),
	playerId: uuid("player_id").notNull(),
	gameState: jsonb("game_state").notNull(),
	autoSave: boolean("auto_save").default(true).notNull(),
	saveName: text("save_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [gameSessions.id],
			name: "game_states_session_id_game_sessions_id_fk"
		}),
]);

export const activeGames = pgTable("active_games", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	playerId: uuid("player_id").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastCheckpointId: uuid("last_checkpoint_id"),
	gameMetadata: jsonb("game_metadata"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("active_games_player_idx").using("btree", table.playerId.asc().nullsLast().op("uuid_ops")),
	unique("active_games_player_id_unique").on(table.playerId),
]);

export const gameCheckpoints = pgTable("game_checkpoints", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gameId: uuid("game_id").notNull(),
	playerId: uuid("player_id").notNull(),
	gameState: jsonb("game_state").notNull(),
	checkpointType: text("checkpoint_type").notNull(),
	year: integer().notNull(),
	quarter: integer().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("checkpoints_game_idx").using("btree", table.gameId.asc().nullsLast().op("uuid_ops")),
	index("checkpoints_latest_idx").using("btree", table.gameId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsLast().op("timestamptz_ops")),
	index("checkpoints_player_idx").using("btree", table.playerId.asc().nullsLast().op("uuid_ops")),
	index("checkpoints_time_idx").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.quarter.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [activeGames.id],
			name: "game_checkpoints_game_id_active_games_id_fk"
		}).onDelete("cascade"),
]);

export const gameActions = pgTable("game_actions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gameId: uuid("game_id").notNull(),
	playerId: uuid("player_id").notNull(),
	actionType: text("action_type").notNull(),
	actionData: jsonb("action_data").notNull(),
	sequenceNumber: integer("sequence_number").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	fullGameState: jsonb("full_game_state").notNull(),
	gameEndedAt: timestamp("game_ended_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("actions_active_games_idx").using("btree", table.gameEndedAt.asc().nullsLast().op("timestamptz_ops")),
	index("actions_game_seq_idx").using("btree", table.gameId.asc().nullsLast().op("int4_ops"), table.sequenceNumber.asc().nullsLast().op("int4_ops")),
	index("actions_player_current_idx").using("btree", table.playerId.asc().nullsLast().op("int4_ops"), table.sequenceNumber.desc().nullsLast().op("int4_ops")),
]);

export const scores = pgTable("scores", {
	playerId: uuid("player_id").notNull(),
	score: integer().notNull(),
	runTs: timestamp("run_ts", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	displayName: text("display_name"),
}, (table) => [
	index("scores_player_score_idx").using("btree", table.playerId.asc().nullsLast().op("uuid_ops"), table.score.desc().nullsLast().op("uuid_ops")),
	index("scores_score_idx").using("btree", table.score.desc().nullsLast().op("int4_ops")),
	primaryKey({ columns: [table.playerId, table.runTs], name: "scores_pkey"}),
]);
