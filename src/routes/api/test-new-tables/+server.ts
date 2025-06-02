import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/index';
import { activeGames, gameCheckpoints, gameActions } from '$lib/db/schema';

export const GET: RequestHandler = async () => {
  try {
    const results: any = {};
    
    // Test each table individually
    try {
      const activeGamesTest = await db.select().from(activeGames).limit(1);
      results.activeGames = { success: true, count: activeGamesTest.length };
    } catch (error) {
      results.activeGames = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    try {
      const checkpointsTest = await db.select().from(gameCheckpoints).limit(1);
      results.gameCheckpoints = { success: true, count: checkpointsTest.length };
    } catch (error) {
      results.gameCheckpoints = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    try {
      const actionsTest = await db.select().from(gameActions).limit(1);
      results.gameActions = { success: true, count: actionsTest.length };
    } catch (error) {
      results.gameActions = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    return json({
      success: true,
      message: 'Table access test completed',
      results
    });

  } catch (error) {
    console.error('Table test failed:', error);
    return json({ 
      error: 'Table test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 