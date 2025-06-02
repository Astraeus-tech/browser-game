import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager, type GameMetadata } from '$lib/db/serverGame';
import type { GameState } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { playerId, initialGameState, metadata } = await request.json();

    if (!playerId || !initialGameState) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gameId = await ServerGameManager.startGame(
      playerId, 
      initialGameState as GameState, 
      metadata as GameMetadata
    );

    return json({ 
      success: true, 
      gameId,
      message: 'Game started successfully'
    });

  } catch (error) {
    console.error('Error starting game:', error);
    return json({ 
      error: 'Failed to start game', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 