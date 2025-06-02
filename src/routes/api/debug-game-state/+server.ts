import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { gameActions } from '$lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const playerId = url.searchParams.get('playerId');

  if (!playerId) {
    return json({ error: 'Missing playerId parameter' }, { status: 400 });
  }

  try {
    // Get all actions for this player
    const allActions = await db
      .select()
      .from(gameActions)
      .where(eq(gameActions.player_id, playerId))
      .orderBy(desc(gameActions.created_at))
      .limit(20);

    // Group by game_id
    const gamesByGameId = new Map();
    allActions.forEach(action => {
      if (!gamesByGameId.has(action.game_id)) {
        gamesByGameId.set(action.game_id, []);
      }
      gamesByGameId.get(action.game_id).push(action);
    });

    const gamesSummary = Array.from(gamesByGameId.entries()).map(([gameId, actions]) => {
      const sortedActions = actions.sort((a, b) => a.sequence_number - b.sequence_number);
      const latestAction = sortedActions[sortedActions.length - 1];
      
      return {
        gameId,
        totalActions: actions.length,
        isEnded: latestAction.game_ended_at !== null,
        lastActionType: latestAction.action_type,
        lastActionTime: latestAction.created_at,
        gameEndedAt: latestAction.game_ended_at,
        finalGameState: latestAction.full_game_state?.gameOver,
        actions: sortedActions.map(a => ({
          type: a.action_type,
          sequence: a.sequence_number,
          ended: a.game_ended_at !== null,
          timestamp: a.created_at
        }))
      };
    });

    return json({
      playerId,
      totalGames: gamesSummary.length,
      games: gamesSummary,
      debug: {
        hasCompletedGames: gamesSummary.some(g => g.isEnded && g.finalGameState && g.finalGameState !== 'playing'),
        hasActiveGames: gamesSummary.some(g => !g.isEnded),
        mostRecentGame: gamesSummary[0]
      }
    });

  } catch (e: any) {
    console.error('[api/debug-game-state] Error:', e);
    return json({
      error: e.message || 'Database error'
    }, { status: 500 });
  }
}; 