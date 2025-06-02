import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { ServerGameManager } from '$lib/db/serverGame.js';
import { calculateEndingDetails } from '$lib/engine.js';
import type { GameState, Ending } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;
  
  if (databaseMode !== 'remote') {
    return json({ error: 'This endpoint only works in remote mode' }, { status: 400 });
  }

  try {
    const { playerId, displayName, finalGameState } = await request.json();

    if (!playerId) {
      return json({ error: 'Missing playerId' }, { status: 400 });
    }

    if (!displayName) {
      return json({ error: 'Missing displayName' }, { status: 400 });
    }

    if (!finalGameState) {
      return json({ error: 'Missing finalGameState' }, { status: 400 });
    }

    // Validate that the game state is actually ended
    if (finalGameState.gameOver === 'playing' || finalGameState.gameOver === 'intro' || !finalGameState.gameOver) {
      return json({ error: 'Game is not completed' }, { status: 400 });
    }

    // Get the current active game for this player
    const currentGameData = await ServerGameManager.getGameState(playerId);
    if (!currentGameData) {
      return json({ error: 'No active game found for this player' }, { status: 404 });
    }

    const gameId = currentGameData.gameId;

    // First end the game outside of transaction (since ServerGameManager uses its own transactions)
    await ServerGameManager.endGame(gameId, playerId, finalGameState as GameState);

    // Calculate score on server for security
    const endingDetails = finalGameState.gameOver as Ending;
    const endingWithScore = calculateEndingDetails(endingDetails, finalGameState as GameState);
    
    if (!endingWithScore.scoreDetails) {
      return json({ error: 'Score calculation failed' }, { status: 500 });
    }

    const score = endingWithScore.scoreDetails.total;

    // Insert the score into database with game_id link
    const insertedData = await db
      .insert(scores)
      .values({
        player_id: playerId,
        game_id: gameId,
        score: score,
        display_name: displayName,
      })
      .returning();

    const result = {
      success: true,
      gameId,
      submittedScore: insertedData[0],
      calculatedScore: score
    };

    console.log('[API] Game ended and score submitted successfully:', { 
      playerId, 
      gameId: result.gameId, 
      score: result.calculatedScore, 
      displayName 
    });

    return json(result, { status: 200 });

  } catch (e: any) {
    console.error('[API] Exception during atomic game end + score submission:', e);
    return json({ 
      error: 'Failed to end game and submit score', 
      details: e.message 
    }, { status: 500 });
  }
}; 