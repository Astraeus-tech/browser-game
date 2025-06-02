import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { desc, gt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    return json({ error: 'Local mode: Debug disabled' });
  }

  const testScore = parseInt(url.searchParams.get('score') || '100');

  try {
    // Test the exact same query as the leaderboard API
    console.log(`[DEBUG] Testing rank calculation for score: ${testScore}`);
    
    // Direct SQL query to see what's happening
    const rawResult = await db.execute(sql`
      SELECT COUNT(DISTINCT score) as count 
      FROM scores 
      WHERE score > ${testScore}
    `);
    console.log('[DEBUG] Raw SQL result:', rawResult);

    // Using Drizzle query builder
    const [drizzleResult] = await db
      .select({ count: sql<number>`count(distinct score)` })
      .from(scores)
      .where(gt(scores.score, testScore));
    console.log('[DEBUG] Drizzle result:', drizzleResult);

    // Alternative query using explicit casting
    const [castResult] = await db
      .select({ count: sql<number>`count(distinct score)::integer` })
      .from(scores)
      .where(gt(scores.score, testScore));
    console.log('[DEBUG] Cast result:', castResult);

    // Get total count of records
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scores);

    // Get count of distinct scores
    const [distinctScoresResult] = await db
      .select({ count: sql<number>`count(distinct score)` })
      .from(scores);

    // Get sample of actual scores higher than test score
    const higherScoresSample = await db
      .select({
        score: scores.score
      })
      .from(scores)
      .where(gt(scores.score, testScore))
      .orderBy(desc(scores.score))
      .limit(10);

    return json({
      testScore,
      totalRecords: totalResult?.count || 0,
      distinctScores: distinctScoresResult?.count || 0,
      rawQueryCount: rawResult?.[0]?.count || 0,
      drizzleQueryCount: drizzleResult?.count || 0,
      castQueryCount: castResult?.count || 0,
      calculatedRank: (drizzleResult?.count || 0) + 1,
      higherScoresSample
    });

  } catch (e: any) {
    console.error('[api/debug-scores] Error:', e);
    return json({
      error: e.message || 'Database error'
    }, { status: 500 });
  }
}; 