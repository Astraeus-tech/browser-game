import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/index';
import { scores } from '$lib/db/schema';

export const GET: RequestHandler = async () => {
  try {
    // Test basic connection with existing scores table
    const scoresCount = await db.select().from(scores).limit(1);
    
    return json({
      success: true,
      message: 'Database connection working',
      scoresTableWorks: true,
      sampleCount: scoresCount.length
    });

  } catch (error) {
    console.error('Database connection test failed:', error);
    return json({ 
      error: 'Database connection failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 