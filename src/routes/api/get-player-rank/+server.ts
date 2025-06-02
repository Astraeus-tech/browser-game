import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { gt, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    return json({
      rank: null,
      totalPlayers: 0,
      topScores: [],
      error: 'Local mode: Ranking is disabled.'
    });
  }

  const playerScore = parseInt(url.searchParams.get('score') || '0');
  const playerName = url.searchParams.get('name') || 'Anonymous';

  if (!playerScore) {
    return json({ error: 'Score parameter is required' }, { status: 400 });
  }

  try {
    // Fast rank calculation using COUNT of DISTINCT higher scores
    const [rankResult] = await db
      .select({ count: sql<number>`count(distinct score)` })
      .from(scores)
      .where(gt(scores.score, playerScore));

    const rank = (rankResult?.count || 0) + 1;

    // Get top 15 scores for leaderboard display
    const topScores = await db
      .select({
        display_name: scores.display_name,
        score: scores.score
      })
      .from(scores)
      .orderBy(desc(scores.score), desc(scores.run_ts))
      .limit(15);

    // Get total number of players
    const [totalResult] = await db
      .select({ count: sql<number>`count(distinct player_id)` })
      .from(scores);

    const totalPlayers = totalResult?.count || 0;

    console.log(`[api/get-player-rank] Player rank: ${rank} out of ${totalPlayers} players`);

    return json({
      rank,
      totalPlayers,
      topScores,
      playerScore,
      playerName,
      error: null
    });

  } catch (e: any) {
    console.error('[api/get-player-rank] Exception calculating rank:', e);
    return json({
      rank: null,
      totalPlayers: 0,
      topScores: [],
      error: e.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}; 