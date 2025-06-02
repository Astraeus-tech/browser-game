/**
 * Submit Score API Endpoint
 * 
 * IMPORTANT: Game State Handling by Mode
 * 
 * Remote Mode (VITE_DATABASE_MODE=remote):
 * - Server loads the authoritative game state from gameActions table
 * - Client only sends playerId and displayName
 * - This prevents score manipulation and ensures data integrity
 * 
 * Local Mode (VITE_DATABASE_MODE≠remote):
 * - Client sends the game state along with playerId and displayName
 * - Server uses the client-provided game state for scoring
 * - Used for offline/local development scenarios
 */

import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { ServerGameManager } from '$lib/db/serverGame.js';
import { calculateEndingDetails } from '$lib/engine.js';
import type { GameState, Ending } from '$lib/types';

export async function POST({ request }) {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;
  
  const { playerId, displayName } = await request.json();

  if (!playerId) {
    return json({ error: 'Missing playerId' }, { status: 400 });
  }

  if (!displayName) {
    return json({ error: 'Missing displayName' }, { status: 400 });
  }

  let typedGameState: GameState;
  let gameId: string | null = null;

  // Get the most recent completed game state for this player
  try {
    const gameData = await ServerGameManager.getMostRecentCompletedGame(playerId);
    
    if (!gameData) {
      console.warn('[API] No completed game found, checking for any recent game for this player...');
      // Fallback: try to get the most recent active game state as well
      const activeGameData = await ServerGameManager.getGameState(playerId);
      if (activeGameData && activeGameData.gameState.gameOver !== 'playing' && activeGameData.gameState.gameOver !== 'intro') {
        console.log('[API] Found active game with ended state, using it for score calculation');
        typedGameState = activeGameData.gameState;
        gameId = activeGameData.gameId;
      } else {
        return json({ error: 'No completed game found for score submission' }, { status: 404 });
      }
    } else {
      typedGameState = gameData.gameState;
      gameId = gameData.gameId; // Get the game_id for linking (will be present for new runs)
      console.log('[API] Loading completed game state for score calculation, gameId:', gameId);
    }
    
  } catch (e: any) {
    console.error('[API] Error loading completed game state:', e);
    return json({ error: 'Database error loading game state: ' + e.message }, { status: 500 });
  }

  if (typedGameState.gameOver === 'playing' || typedGameState.gameOver === 'intro' || !typedGameState.gameOver) {
    console.warn('[API] Game is not completed - cannot submit score.');
    return json({ error: 'Game is not completed' }, { status: 400 });
  }

  const endingDetails = typedGameState.gameOver as Ending;
  
  // Calculate score on server for security (recalculate even if client provided it)
  const endingWithScore = calculateEndingDetails(endingDetails, typedGameState);
  
  if (!endingWithScore.scoreDetails) {
    console.error('[API] Score calculation failed');
    return json({ error: 'Score calculation failed' }, { status: 500 });
  }

  const score = endingWithScore.scoreDetails.total;

  try {
    // Insert the score into database with game_id link (null for legacy data)
    const insertedData = await db
      .insert(scores)
      .values({
        player_id: playerId,
        game_id: gameId, // Will be null for legacy runs, UUID for new runs
        score: score,
        display_name: displayName,
      })
      .returning();

    console.log('[API] Score calculated and submitted successfully:', { playerId, gameId, score, displayName });
    return json({ 
      success: true, 
      message: 'Score calculated and submitted successfully', 
      submittedScore: insertedData[0],
      calculatedScore: score,
      gameId: gameId
    }, { status: 200 });

  } catch (e: any) {
    console.error('[API] Exception during score submission:', e);
    return json({ error: 'Database error: ' + e.message }, { status: 500 });
  }
} 