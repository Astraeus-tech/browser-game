import { supabase } from '$lib/supabaseClient';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const playerId = url.searchParams.get('playerId');
  const scoreParam = url.searchParams.get('score');

  if (!playerId || !scoreParam) {
    return json({ error: 'playerId and score are required' }, { status: 400 });
  }

  const scoreValue = parseInt(scoreParam, 10);
  if (isNaN(scoreValue)) {
    return json({ error: 'Invalid score format' }, { status: 400 });
  }

  try {
    // Get the display_name for the player from their latest score entry.
    // It's assumed that /api/submit-score correctly stores the display_name.
    let displayName = 'Anonymous'; // Default
    const { data: playerData, error: playerError } = await supabase
      .from('scores')
      .select('display_name')
      .eq('player_id', playerId)
      .order('run_ts', { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle to handle no rows gracefully (returns null)

    if (playerError) {
      console.error('[api/get-player-rank] Error fetching player display name:', playerError);
      // Don't fail outright, can proceed with default display name or playerId
    }
    if (playerData && playerData.display_name) {
      displayName = playerData.display_name;
    } else {
      console.warn(`[api/get-player-rank] Display name for playerId ${playerId} not found in scores table. Using default or passed name if available. Client should ideally pass current display name for robustness.`);
      // If client passes display name as query param, could use it here as a fallback.
      // For now, relies on DB lookup or default.
    }

    // Calculate rank: 1 + number of distinct scores strictly greater than the player's current score.
    // This counts how many unique score values are better.
    // For a more traditional rank (where ties get same rank), SQL RANK() over scores would be better,
    // but that requires a more complex query to pick out a specific player's rank.
    // This approach (count of better scores + 1) is common.
    const { count, error: rankError } = await supabase
      .from('scores')
      .select('score', { count: 'exact', head: true }) // Count rows
      .gt('score', scoreValue);

    if (rankError) {
      console.error('[api/get-player-rank] Error calculating rank:', rankError);
      return json({ error: 'Failed to calculate rank' }, { status: 500 });
    }

    const rank = (count || 0) + 1;

    return json({
      rank,
      display_name: displayName,
      score: scoreValue,
    });

  } catch (e: any) {
    console.error('[api/get-player-rank] Exception:', e);
    return json({ error: 'An unexpected error occurred while fetching player rank' }, { status: 500 });
  }
}; 