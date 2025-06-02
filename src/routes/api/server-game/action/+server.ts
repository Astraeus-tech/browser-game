import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager, type GameAction } from '$lib/db/serverGame';
import type { GameState } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { gameId, playerId, newGameState, action } = await request.json();

    if (!gameId || !playerId || !newGameState || !action) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate the action
    if (!ServerGameManager.validateAction(newGameState as GameState, action as GameAction)) {
      return json({ error: 'Invalid action' }, { status: 400 });
    }

    await ServerGameManager.updateGameState(
      gameId,
      playerId,
      newGameState as GameState,
      action as GameAction
    );

    return json({ 
      success: true,
      message: 'Game state updated successfully'
    });

  } catch (error) {
    console.error('Error updating game state:', error);
    return json({ 
      error: 'Failed to update game state', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 