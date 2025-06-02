import { relations } from "drizzle-orm/relations";
import { gameSessions, gameStates, activeGames, gameCheckpoints } from "./schema";

export const gameStatesRelations = relations(gameStates, ({one}) => ({
	gameSession: one(gameSessions, {
		fields: [gameStates.sessionId],
		references: [gameSessions.id]
	}),
}));

export const gameSessionsRelations = relations(gameSessions, ({many}) => ({
	gameStates: many(gameStates),
}));

export const gameCheckpointsRelations = relations(gameCheckpoints, ({one}) => ({
	activeGame: one(activeGames, {
		fields: [gameCheckpoints.gameId],
		references: [activeGames.id]
	}),
}));

export const activeGamesRelations = relations(activeGames, ({many}) => ({
	gameCheckpoints: many(gameCheckpoints),
}));