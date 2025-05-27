import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  // Check the database mode
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    console.log(`[api/get-leaderboard] Database mode is '${databaseMode || 'undefined/not set'}'. Running in local mode.`);
    return json({
      leaderboard: [],
      error: 'Local mode: Leaderboard is disabled.'
    });
  }

  console.log('[api/get-leaderboard] Fetching fresh leaderboard after game end');
  
  try {
    // Fetch top 100 scores, ordered by score descending, then by timestamp for tie-breaking
    const { data: leaderboard, error } = await supabase
      .from('scores')
      .select('display_name, score')
      .order('score', { ascending: false })
      .order('run_ts', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[api/get-leaderboard] Error fetching leaderboard:', error);
      return json({
        leaderboard: [],
        error: error.message
      }, { status: 500 });
    }

    console.log(`[api/get-leaderboard] Successfully fetched ${leaderboard?.length || 0} scores`);
    
    return json({
      leaderboard: leaderboard || [],
      error: null
    });

  } catch (e: any) {
    console.error('[api/get-leaderboard] Exception fetching leaderboard:', e);
    return json({
      leaderboard: [],
      error: e.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}; 