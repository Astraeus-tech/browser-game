import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/index';
import { activeGames, gameCheckpoints, gameActions } from '$lib/db/schema';

export const GET: RequestHandler = async () => {
  try {
    // Test if the new tables exist by counting rows
    const [activeGamesCount, checkpointsCount, actionsCount] = await Promise.all([
      db.select().from(activeGames).limit(1),
      db.select().from(gameCheckpoints).limit(1),
      db.select().from(gameActions).limit(1)
    ]);

    return json({
      success: true,
      message: 'Server-authoritative tables are working!',
      tableStatus: {
        activeGames: 'exists',
        gameCheckpoints: 'exists', 
        gameActions: 'exists'
      },
      sampleCounts: {
        activeGames: activeGamesCount.length,
        checkpoints: checkpointsCount.length,
        actions: actionsCount.length
      }
    });

  } catch (error) {
    console.error('Error testing server game tables:', error);
    return json({ 
      error: 'Failed to test server game tables', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 