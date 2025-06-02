import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores, gameActions } from '$lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const playerId = url.searchParams.get('playerId');
  const gameId = url.searchParams.get('gameId');

  if (!playerId) {
    return json({ error: 'Missing playerId parameter' }, { status: 400 });
  }

  try {
    // Get the latest score for this player
    const playerScores = await db
      .select()
      .from(scores)
      .where(eq(scores.player_id, playerId))
      .orderBy(desc(scores.run_ts))
      .limit(1);

    if (playerScores.length === 0) {
      return json({ error: 'No scores found for this player' }, { status: 404 });
    }

    const scoreRecord = playerScores[0];
    
    // If this score has a game_id, get the full game run details
    let gameRunDetails = null;
    if (scoreRecord.game_id) {
      const gameHistory = await db
        .select()
        .from(gameActions)
        .where(eq(gameActions.game_id, scoreRecord.game_id))
        .orderBy(gameActions.sequence_number);

      gameRunDetails = {
        gameId: scoreRecord.game_id,
        totalActions: gameHistory.length,
        actions: gameHistory.map(action => ({
          sequence: action.sequence_number,
          type: action.action_type,
          timestamp: action.created_at,
          gameState: {
            year: action.full_game_state.year,
            quarter: action.full_game_state.quarter,
            gameOver: action.full_game_state.gameOver,
            // Include key metrics for analysis
            revenue: action.full_game_state.meters.company.revenue,
            credits: action.full_game_state.meters.company.credits,
            aiProgress: action.full_game_state.meters.ai_capability.progress,
            environmentStability: action.full_game_state.meters.environment.stability
          },
          actionData: action.action_data
        })),
        startedAt: gameHistory[0]?.created_at,
        endedAt: gameHistory[gameHistory.length - 1]?.created_at,
        finalScore: scoreRecord.score
      };
    }

    return json({
      scoreRecord: {
        score: scoreRecord.score,
        displayName: scoreRecord.display_name,
        submittedAt: scoreRecord.run_ts,
        gameId: scoreRecord.game_id,
        hasGameDetails: !!scoreRecord.game_id
      },
      gameRunDetails,
      message: scoreRecord.game_id 
        ? 'Score linked to complete game run with full audit trail'
        : 'Legacy score - no game run details available'
    });

  } catch (e: any) {
    console.error('[api/score-details] Error:', e);
    return json({
      error: e.message || 'Database error'
    }, { status: 500 });
  }
}; 