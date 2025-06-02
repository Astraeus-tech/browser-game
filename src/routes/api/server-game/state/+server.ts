import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const playerId = url.searchParams.get('playerId');

    if (!playerId) {
      return json({ error: 'Missing playerId parameter' }, { status: 400 });
    }

    const gameData = await ServerGameManager.getGameState(playerId);

    if (!gameData) {
      return json({ 
        success: false, 
        message: 'No active game found for player' 
      });
    }

    return json({ 
      success: true, 
      ...gameData
    });

  } catch (error) {
    console.error('Error getting game state:', error);
    return json({ 
      error: 'Failed to get game state', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 