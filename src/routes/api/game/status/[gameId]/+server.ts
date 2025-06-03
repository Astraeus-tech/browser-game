import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const gameId = params.gameId;
    const playerId = url.searchParams.get('playerId');

    if (!gameId || !playerId) {
      return json({ error: 'gameId and playerId are required' }, { status: 400 });
    }

    const gameData = await ServerGameManager.getGameState(playerId);
    if (!gameData) {
      return json({ error: 'Game not found or unauthorized' }, { status: 404 });
    }

    return json({
      success: true,
      gameState: gameData.gameState,
      metadata: gameData.metadata,
      gameId: gameData.gameId
    });

  } catch (error) {
    console.error('Error getting game status:', error);
    return json({ 
      error: 'Failed to get game status', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 