import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient'; // This now uses private env vars
import type { GameState, Ending } from '$lib/types';

export async function POST({ request }) {
  const { gameState, playerId, displayName } = await request.json();

  if (!gameState || !playerId) {
    return json({ error: 'Missing gameState or playerId' }, { status: 400 });
  }

  const typedGameState = gameState as GameState;

  if (typedGameState.gameOver === 'playing' || !typedGameState.gameOver) {
    console.warn('[API] Attempted to submit score for a game that is still playing or has no gameOver state.');
    return json({ error: 'Game is still playing or has no gameOver state' }, { status: 400 });
  }

  const endingDetails = typedGameState.gameOver as Ending;
  if (!endingDetails.scoreDetails) {
    console.warn('[API] Attempted to submit score, but scoreDetails are missing from gameOver state.');
    return json({ error: 'Missing scoreDetails in gameOver state' }, { status: 400 });
  }

  const score = endingDetails.scoreDetails.total;

  const objectToInsert = {
    player_id: playerId,
    score: score,
    display_name: displayName,
    // Optional fields you might have commented out:
    // run_duration_quarters: endingDetails.stats?.totalQuartersElapsed,
    // ending_id: endingDetails.id,
    // final_year: typedGameState.year,
    // final_quarter: typedGameState.quarter,
  };



  try {
    const { data, error } = await supabase
      .from('scores')
      .insert(objectToInsert) // Use the logged object
      .select(); // .select() can be useful to get the inserted row back, or just for confirmation

    if (error) {
      console.error('[API] Error submitting score to Supabase:', error);
      return json({ error: 'Supabase error: ' + error.message }, { status: 500 });
    }

    console.log('[API] Score submitted successfully:', { playerId, score, displayName, insertedData: data });
    return json({ success: true, message: 'Score submitted successfully', submittedScore: data?.[0] }, { status: 200 });

  } catch (e: any) {
    console.error('[API] Exception during score submission:', e);
    return json({ error: 'Server exception: ' + e.message }, { status: 500 });
  }
} 