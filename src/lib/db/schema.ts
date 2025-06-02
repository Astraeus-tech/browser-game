import { pgTable, serial, text, integer, uuid, timestamp, jsonb, boolean, primaryKey, index } from 'drizzle-orm/pg-core';
import type { GameState } from '../types';

// Scores table (optimized with indexes for fast ranking)
export const scores = pgTable('scores', {
  player_id: uuid('player_id').notNull(),
  game_id: uuid('game_id'), // Links to gameActions.game_id (nullable to preserve existing data)
  score: integer('score').notNull(),
  run_ts: timestamp('run_ts', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  display_name: text('display_name'),
}, (table) => [
  primaryKey({ columns: [table.player_id, table.run_ts], name: 'scores_pkey' }),
  index('scores_score_idx').on(table.score.desc()), // Fast ranking queries
  index('scores_player_score_idx').on(table.player_id, table.score.desc()), // Player-specific queries
  index('scores_game_idx').on(table.game_id), // Link to specific game runs
]);

// Game actions - SIMPLIFIED ARCHITECTURE: everything in one table  
export const gameActions = pgTable("game_actions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	game_id: uuid("game_id").notNull(),
	player_id: uuid("player_id").notNull(),
	action_type: text("action_type").notNull(),
	action_data: jsonb("action_data").notNull(),
	sequence_number: integer("sequence_number").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	full_game_state: jsonb("full_game_state").$type<GameState>().notNull(),
	game_ended_at: timestamp("game_ended_at", { withTimezone: true }),
}, (table) => [
	index("actions_active_games_idx").on(table.game_ended_at),
	index("actions_game_seq_idx").on(table.game_id, table.sequence_number),
	index("actions_player_current_idx").on(table.player_id, table.sequence_number.desc()),
]);

// DEPRECATED TABLES - Keeping for migration compatibility but not using
export const activeGames = pgTable('active_games', {
  id: uuid('id').defaultRandom().primaryKey(),
  player_id: uuid('player_id').notNull().unique(),
  started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  last_checkpoint_id: uuid('last_checkpoint_id'),
  game_metadata: jsonb('game_metadata'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('active_games_player_idx').on(table.player_id)
]);

export const gameCheckpoints = pgTable('game_checkpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  game_id: uuid('game_id').notNull().references(() => activeGames.id, { onDelete: 'cascade' }),
  player_id: uuid('player_id').notNull(),
  game_state: jsonb('game_state').$type<GameState>().notNull(),
  checkpoint_type: text('checkpoint_type').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('checkpoints_game_idx').on(table.game_id),
  index('checkpoints_player_idx').on(table.player_id),
  index('checkpoints_time_idx').on(table.year, table.quarter),
  index('checkpoints_latest_idx').on(table.game_id, table.created_at.desc())
]);

// Legacy tables (DEPRECATED - keeping for migration compatibility)
export const gameSessions = pgTable('game_sessions', {
  id: serial('id').primaryKey(),
  player_id: uuid('player_id').notNull(),
  session_name: text('session_name').default('Main Game'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const gameStates = pgTable('game_states', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id').references(() => gameSessions.id),
  player_id: uuid('player_id').notNull(),
  game_state: jsonb('game_state').$type<GameState>().notNull(),
  auto_save: boolean('auto_save').default(true).notNull(),
  save_name: text('save_name'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}); 