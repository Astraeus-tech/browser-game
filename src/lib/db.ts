// import { supabase } from './supabaseClient'; // No longer needed here
import { getPlayerId, getDisplayName } from './player';
import type { GameState, Ending } from './types';

export async function submitRunScore(displayNameFromModal?: string): Promise<boolean> {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  // Default to local mode if VITE_DATABASE_MODE is not explicitly 'remote'
  if (databaseMode !== 'remote') {
    console.log(`Database mode is '${databaseMode || 'undefined/not set'}'. Running in local mode: Skipping database submission.`);
    return true; // Simulate successful submission
  }

  // Proceed with remote submission only if databaseMode === 'remote'
  console.log('Database mode is \'remote\'. Attempting database submission.');

  const playerId = getPlayerId();
  if (!playerId) {
    console.warn('Player ID not found, cannot submit score.');
    return false;
  }

  // Use displayNameFromModal if provided (from the modal input), otherwise get from localStorage
  const displayName = displayNameFromModal || getDisplayName();
  if (!displayName) {
    console.warn('Display name not found, cannot submit score.');
    return false;
  }

  try {
    const response = await fetch('/api/submit-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerId, displayName }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error submitting score via API:', result.error || response.statusText);
      return false;
    } else {
      console.log('Score submitted successfully via API:', result.message);
      if (result.calculatedScore) {
        console.log('Server calculated score:', result.calculatedScore);
      }
      return true;
    }
  } catch (e) {
    console.error('Exception during API score submission:', e);
    return false;
  }
}

/**
 * Atomically end the game and submit score in a single transaction
 * This eliminates race conditions between ending game and score submission
 */
export async function endGameAndSubmitScore(finalGameState: GameState, displayNameFromModal?: string): Promise<boolean> {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  // Default to local mode if VITE_DATABASE_MODE is not explicitly 'remote'
  if (databaseMode !== 'remote') {
    console.log(`Database mode is '${databaseMode || 'undefined/not set'}'. Running in local mode: Skipping atomic submission.`);
    return true; // Simulate successful submission
  }

  console.log('Database mode is \'remote\'. Attempting atomic game end + score submission.');

  const playerId = getPlayerId();
  if (!playerId) {
    console.warn('Player ID not found, cannot end game and submit score.');
    return false;
  }

  // Use displayNameFromModal if provided (from the modal input), otherwise get from localStorage
  const displayName = displayNameFromModal || getDisplayName();
  if (!displayName) {
    console.warn('Display name not found, cannot end game and submit score.');
    return false;
  }

  try {
    const response = await fetch('/api/end-game-and-submit-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        playerId, 
        displayName, 
        finalGameState 
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error ending game and submitting score via API:', result.error || response.statusText);
      return false;
    } else {
      console.log('Game ended and score submitted successfully via API:', result);
      if (result.calculatedScore) {
        console.log('Server calculated score:', result.calculatedScore);
      }
      return true;
    }
  } catch (e) {
    console.error('Exception during atomic game end + score submission:', e);
    return false;
  }
}

// Functions for getting top scores and player's best (as in your example)
// can be added here later if needed for display within the game.
// These would also call new server endpoints. 