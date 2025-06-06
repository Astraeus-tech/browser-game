import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    return json({
      leaderboard: [],
      error: 'Local mode: Leaderboard disabled'
    });
  }

  try {
    // Get top 100 scores for analytics
    const topScores = await db
      .select({
        display_name: scores.display_name,
        score: scores.score,
        player_id: scores.player_id,
        run_ts: scores.run_ts
      })
      .from(scores)
      .orderBy(desc(scores.score), desc(scores.run_ts))
      .limit(100);

    // Add rank to all entries
    const leaderboard = topScores.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    return json({
      leaderboard,
      error: null
    });

  } catch (e: any) {
    console.error('[api/analytics-leaderboard] Error:', e);
    return json({
      leaderboard: [],
      error: e.message || 'Database error'
    }, { status: 500 });
  }
}; 