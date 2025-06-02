import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables from .env
config();

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING!,
    ssl: { rejectUnauthorized: false },
  },
  // Configure for Supabase provider to handle Supabase-specific entities
  entities: {
    roles: {
      provider: 'supabase'
    }
  }
}); 