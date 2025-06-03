import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';
import { getDefaultState } from '$lib/stores/game';
import { v4 as uuidv4 } from 'uuid';
import events from '$lib/content/events';
import type { Event, GameState } from '$lib/types';
import { makeRng } from '$lib/rng';

export const POST: RequestHandler = async ({ request }) => {
  const startTime = performance.now();
  try {
    const { displayName } = await request.json();

    if (!displayName || typeof displayName !== 'string') {
      return json({ error: 'Valid displayName is required' }, { status: 400 });
    }

    // Generate a unique player ID for this session
    const playerId = uuidv4();
    
    // Initialize default game state
    const initialGameState = getDefaultState();

    // Select the first event for the current year/quarter BEFORE starting game
    const availableEvents = (events as Event[]).filter(e =>
      e.year === initialGameState.year && e.quarter === initialGameState.quarter
    );

    if (availableEvents.length === 0) {
      return json({ error: 'No events available for game start' }, { status: 500 });
    }

    // Use the game's RNG to select an event deterministically
    const { rng, nextSeed } = makeRng(initialGameState);
    const eventIndex = Math.floor(rng() * availableEvents.length);
    const selectedEvent = availableEvents[eventIndex];

    // Create the complete initial game state with event already selected
    const completeInitialGameState: GameState = {
      ...initialGameState,
      seed: nextSeed,
      currentEventId: selectedEvent.id,
      gameOver: 'playing' // Set to playing mode
    };

    // Start the game on the server with the complete state (single DB operation)
    const dbStartTime = performance.now();
    const gameId = await ServerGameManager.startGame(playerId, completeInitialGameState, {
      settings: { displayName, startedAt: Date.now() }
    });
    const dbEndTime = performance.now();

    const totalTime = performance.now() - startTime;
    console.log(`[PERF] Game start - Total: ${totalTime.toFixed(2)}ms, DB: ${(dbEndTime - dbStartTime).toFixed(2)}ms`);

    return json({
      success: true,
      gameId,
      playerId,
      gameState: completeInitialGameState
    });

  } catch (error) {
    console.error('Error starting game:', error);
    return json({ 
      error: 'Failed to start game', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 