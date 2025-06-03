import { db } from '$lib/db/index.js';
import { scores } from '$lib/db/schema.js';
import { count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Check the database mode
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    return {
      gameCount: 0
    };
  }

  try {
    // Count total rows in scores table using Drizzle ORM
    const result = await db
      .select({ count: count() })
      .from(scores);

    const gameCount = result[0]?.count || 0;

    return {
      gameCount
    };
  } catch (e: any) {
    console.error('[page.server] Exception fetching game count:', e);
    return {
      gameCount: 0
    };
  }
}; 