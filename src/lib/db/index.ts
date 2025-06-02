import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Get database URL from environment, with fallback construction for development
function getDatabaseUrl(): string {
  // First try to use explicit DATABASE_URL if available
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  
  // Check for POSTGRES_PRISMA_URL (common with Vercel/Supabase)
  if (env.POSTGRES_PRISMA_URL) {
    return env.POSTGRES_PRISMA_URL;
  }
  
  // Fall back to constructing from Supabase credentials
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    const projectRef = env.SUPABASE_URL.split('//')[1].split('.')[0];
    return `postgresql://postgres:${env.SUPABASE_ANON_KEY}@db.${projectRef}.supabase.co:5432/postgres`;
  }
  
  throw new Error('No database connection URL available. Please set DATABASE_URL, POSTGRES_PRISMA_URL, or SUPABASE_URL/SUPABASE_ANON_KEY environment variables.');
}

// For Supabase connection pooler, disable prepared statements
// This is required when using Supabase's transaction pooler
const client = postgres(getDatabaseUrl(), { 
  prepare: false,
  // Connection pooling settings optimized for Supabase
  max: 1,
});

export const db = drizzle(client, { schema }); 