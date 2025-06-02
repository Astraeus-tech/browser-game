import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    return json({
      leaderboard: [],
      playerRank: null,
      playerEntry: null,
      error: 'Local mode: Leaderboard disabled'
    });
  }

  const playerId = url.searchParams.get('playerId');

  try {
    // Get top 10 scores
    const topScores = await db
      .select({
        display_name: scores.display_name,
        score: scores.score,
        player_id: scores.player_id
      })
      .from(scores)
      .orderBy(desc(scores.score), desc(scores.run_ts))
      .limit(10);

    // Add rank to top 10
    const leaderboard = topScores.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentUser: playerId ? entry.player_id === playerId : false
    }));

    let playerRank = null;
    let playerEntry = null;

    if (playerId) {
      // Get player's latest score
      const playerScores = await db
        .select({
          display_name: scores.display_name,
          score: scores.score,
          player_id: scores.player_id
        })
        .from(scores)
        .where(eq(scores.player_id, playerId))
        .orderBy(desc(scores.run_ts))
        .limit(1);

      if (playerScores.length > 0) {
        const playerScore = playerScores[0].score;
        
        // Calculate player's rank: count distinct scores higher than player's
        const [rankResult] = await db
          .select({ count: sql<number>`count(distinct score)::integer` })
          .from(scores)
          .where(sql`score > ${playerScore}`);

        playerRank = (rankResult?.count || 0) + 1;
        
        playerEntry = {
          ...playerScores[0],
          rank: playerRank,
          isCurrentUser: true
        };
      }
    }

    return json({
      leaderboard,
      playerRank,
      playerEntry,
      error: null
    });

  } catch (e: any) {
    console.error('[api/leaderboard-with-rank] Error:', e);
    return json({
      leaderboard: [],
      playerRank: null,
      playerEntry: null,
      error: e.message || 'Database error'
    }, { status: 500 });
  }
}; 