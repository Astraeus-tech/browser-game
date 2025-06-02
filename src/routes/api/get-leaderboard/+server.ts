import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { desc } from 'drizzle-orm';
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
    // Fetch top 15 scores using Drizzle ORM, ordered by score descending, then by timestamp for tie-breaking
    const leaderboard = await db
      .select({
        display_name: scores.display_name,
        score: scores.score
      })
      .from(scores)
      .orderBy(desc(scores.score), desc(scores.run_ts))
      .limit(15);

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