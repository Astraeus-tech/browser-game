import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';
import { db } from '$lib/db/index';
import { scores } from '$lib/db/schema';
import events from '$lib/content/events';
import type { Event, GameState } from '$lib/types';
import { makeRng } from '$lib/rng';
import { applyChoice } from '$lib/engine';

export const POST: RequestHandler = async ({ request }) => {
  const startTime = performance.now();
  try {
    const { gameId, playerId, choiceIndex } = await request.json();

    if (!gameId || !playerId || typeof choiceIndex !== 'number') {
      return json({ error: 'gameId, playerId, and choiceIndex are required' }, { status: 400 });
    }

    // Get current game state from server (single optimized query)
    const gameData = await ServerGameManager.getGameState(playerId);
    if (!gameData) {
      return json({ error: 'Game not found or unauthorized' }, { status: 404 });
    }

    const currentState = gameData.gameState;

    // Get the current event
    const currentEvent = events.find(e => e.id === currentState.currentEventId);
    if (!currentEvent) {
      return json({ error: 'Current event not found' }, { status: 500 });
    }

    // Validate choice index
    if (choiceIndex < 0 || choiceIndex >= currentEvent.choices.length) {
      return json({ error: 'Invalid choice index' }, { status: 400 });
    }

    const selectedChoice = currentEvent.choices[choiceIndex];

    // Apply choice effects using the existing game engine
    let newState = applyChoice(currentState, selectedChoice);

    // Check if game ended with this choice
    const isGameEnded = newState.gameOver !== 'playing';

    let finalResponse;

    if (isGameEnded) {
      // Calculate final score using existing ending calculation
      const ending = newState.gameOver as any; // It's now an Ending object with scoreDetails
      const finalScore = ending.scoreDetails?.total || 0;
      
      // Get display name from game metadata
      const displayName = gameData.metadata?.settings?.displayName || 'Anonymous';
      
      // Submit score to leaderboard using correct field names
      await db.insert(scores).values({
        player_id: playerId,
        game_id: gameData.gameId,
        score: finalScore,
        display_name: displayName
        // run_ts will be set to now() by default
      });

      // Mark game as ended
      await ServerGameManager.endGame(gameData.gameId, playerId, newState);

      finalResponse = {
        success: true,
        gameState: newState,
        gameEnded: true,
        finalScore,
        ending
      };
    } else {
      // Game continues - select next event for the new time period
      const availableEvents = events.filter(e =>
        e.year === newState.year && e.quarter === newState.quarter
      );

      if (availableEvents.length === 0) {
        // No more events available - this shouldn't happen in normal gameplay
        // but handle gracefully by ending the game with a draw
        let drawEnding = {
          id: 'draw-survival',
          type: 'draw' as const,
          title: 'Survival',
          description: 'You survived to the end of available events.',
          scoreDetails: {
            total: Math.round(
              Object.values(newState.meters.company).reduce((sum, val) => sum + val, 0) +
              Object.values(newState.meters.environment).reduce((sum, val) => sum + val, 0) +
              Object.values(newState.meters.ai_capability).reduce((sum, val) => sum + val, 0)
            ),
            basePoints: {
              progression: 100,
              company: Object.values(newState.meters.company).reduce((sum, val) => sum + val, 0),
              environment: Object.values(newState.meters.environment).reduce((sum, val) => sum + val, 0),
              aiCapability: Object.values(newState.meters.ai_capability).reduce((sum, val) => sum + val, 0)
            }
          }
        };
        
        newState = { ...newState, gameOver: drawEnding };
        
        const displayName = gameData.metadata?.settings?.displayName || 'Anonymous';
        
        await db.insert(scores).values({
          player_id: playerId,
          game_id: gameData.gameId,
          score: drawEnding.scoreDetails.total,
          display_name: displayName
        });

        await ServerGameManager.endGame(gameData.gameId, playerId, newState);

        finalResponse = {
          success: true,
          gameState: newState,
          gameEnded: true,
          finalScore: drawEnding.scoreDetails.total
        };
      } else {
        // Select next event using RNG
        const { rng, nextSeed } = makeRng(newState);
        const eventIndex = Math.floor(rng() * availableEvents.length);
        const nextEvent = availableEvents[eventIndex];

        // Update state with selected event and new seed
        newState = {
          ...newState,
          seed: nextSeed,
          currentEventId: nextEvent.id
        };

        // Save updated state
        await ServerGameManager.updateGameState(gameData.gameId, playerId, newState, {
          type: 'choice',
          data: {
            choiceIndex,
            choiceLabel: selectedChoice.label,
            eventId: currentEvent.id,
            nextEventId: nextEvent.id
          }
        });

        finalResponse = {
          success: true,
          gameState: newState,
          gameEnded: false,
          nextEvent
        };
      }
    }

    const totalTime = performance.now() - startTime;
    console.log(`[PERF] Choice processing - Total: ${totalTime.toFixed(2)}ms`);
    
    return json(finalResponse);

  } catch (error) {
    console.error('Error processing choice:', error);
    return json({ 
      error: 'Failed to process choice', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 