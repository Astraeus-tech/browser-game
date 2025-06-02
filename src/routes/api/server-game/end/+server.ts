import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';
import type { GameState } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { gameId, playerId, finalGameState } = await request.json();

    if (!gameId || !playerId || !finalGameState) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    await ServerGameManager.endGame(
      gameId,
      playerId,
      finalGameState as GameState
    );

    return json({ 
      success: true,
      message: 'Game ended successfully'
    });

  } catch (error) {
    console.error('Error ending game:', error);
    return json({ 
      error: 'Failed to end game', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 