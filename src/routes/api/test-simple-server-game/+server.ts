import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/index';
import { activeGames } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async () => {
  try {
    const testPlayerId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format
    
    // Test the exact operation that's failing
    console.log('Testing delete operation...');
    const deleteResult = await db.delete(activeGames).where(eq(activeGames.player_id, testPlayerId));
    
    console.log('Delete result:', deleteResult);
    
    return json({
      success: true,
      message: 'Simple delete test passed',
      deleteResult
    });

  } catch (error) {
    console.error('Simple test failed:', error);
    return json({ 
      error: 'Simple test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};