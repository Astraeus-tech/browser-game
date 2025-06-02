# Singularity Run Game

An AI strategy game where you lead humanity's future as the CEO of an AI startup on the brink of creating the most powerful artificial intelligence in history. Navigate the complex landscape of AI development while balancing corporate interests, technological advancement, and global stability.

## 🎮 Game Overview

**Singularity Run** is a text-based strategy game built with SvelteKit that simulates the challenges of AI development in a near-future scenario. Players make critical decisions that impact:

- **Company Metrics**: Credits, revenue, valuation, approval, security, and alignment confidence
- **Environmental Factors**: Social stability, cyber/bio risks, and climate impact
- **AI Capabilities**: Coding, hacking, bioweapons, politics/persuasion, robotics, and research capabilities

The game features a dynamic event system spanning from 2025 to 2027, with quarterly decision points that shape the narrative and determine multiple possible endings.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Supabase account** (for database functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd singularity-run-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (see [Environment Configuration](#environment-configuration))

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:5173`

## 🔧 Environment Configuration

The game supports both local and remote database modes and now uses **Drizzle ORM** for type-safe database operations with Supabase.

### For Development (.env.local)

```bash
# Database Configuration (Supabase with Drizzle ORM)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Alternative: Direct database URL (recommended for production)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Database Mode (local/remote)
VITE_DATABASE_MODE=local
```

### For Production (.env.production)

```bash
# Database Configuration (Supabase with Drizzle ORM)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Direct database URL (recommended for production)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Database Mode (local/remote)
VITE_DATABASE_MODE=remote
```

### Environment Variables Explained

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Direct PostgreSQL connection string | Recommended for production | - |
| `SUPABASE_URL` | Your Supabase project URL | Yes (if no DATABASE_URL) | - |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes (if no DATABASE_URL) | - |
| `VITE_DATABASE_MODE` | Database mode: `local` or `remote` | No | `local` |

## 🗄️ Database Setup with Drizzle ORM

### Why Drizzle ORM?

This project now uses **Drizzle ORM** instead of direct Supabase client calls for several benefits:
- **Type Safety**: Full TypeScript support with inferred types
- **Performance**: Optimized queries and better connection pooling
- **Developer Experience**: Intuitive query builder and schema management
- **Migration Management**: Version-controlled database schema changes
- **Supabase Compatible**: Works seamlessly with Supabase's PostgreSQL

### Supabase Configuration

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Get your database credentials**:
   - Go to Settings → Database
   - Copy the connection string from the "Connection Pooler" section
   - Use "Transaction" mode for better compatibility with Drizzle

3. **The scores table should already exist**, but if you need to recreate it:
   ```sql
   CREATE TABLE scores (
     id BIGSERIAL PRIMARY KEY,
     player_id UUID NOT NULL,
     score INTEGER NOT NULL,
     display_name TEXT,
     run_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Add indexes for performance
   CREATE INDEX idx_scores_score ON scores(score DESC);
   CREATE INDEX idx_scores_player_id ON scores(player_id);
   CREATE INDEX idx_scores_run_ts ON scores(run_ts DESC);
   ```

4. **Configure Row Level Security (RLS)**:
   ```sql
   ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

   -- Allow public read access to scores
   CREATE POLICY "Allow public read access" ON scores
     FOR SELECT USING (true);

   -- Allow public insert access
   CREATE POLICY "Allow public insert access" ON scores
     FOR INSERT WITH CHECK (true);
   ```

### Database Operations with Drizzle

You can use the following npm scripts for database operations:

```bash
# Generate migration files from schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# Push schema changes directly (for development)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Database Modes

- **Local Mode** (`VITE_DATABASE_MODE=local`): Game runs without database connectivity. Scores are not persisted, and leaderboards are disabled.
- **Remote Mode** (`VITE_DATABASE_MODE=remote`): Full functionality with score submission and leaderboards via Supabase using Drizzle ORM.

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev -- --open   # Start dev server and open browser

# Building
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run check           # Type checking
npm run check:watch     # Type checking in watch mode
npm run format          # Format code with Prettier
npm run lint            # Lint code with ESLint

# Database Operations (Drizzle ORM)
npm run db:generate     # Generate migrations from schema
npm run db:migrate      # Apply migrations to database
npm run db:push         # Push schema changes directly
npm run db:studio       # Open Drizzle Studio

# SvelteKit
npm run prepare         # Sync SvelteKit types
```

### Project Structure

```
src/
├── lib/
│   ├── components/          # Reusable Svelte components
│   │   ├── ResourceBars.svelte
│   │   ├── TypewriterText.svelte
│   │   └── DisplayNameModal.svelte
│   ├── content/            # Game content and data
│   │   ├── events/         # Event definitions by year/quarter
│   │   │   ├── 2025/
│   │   │   ├── 2026/
│   │   │   └── 2027/
│   │   ├── endings.json    # Game ending definitions
│   │   └── meters.json     # Meter configuration
│   ├── db/                 # Database layer (Drizzle ORM)
│   │   ├── schema.ts       # Database schema definitions
│   │   └── index.ts        # Database client configuration
│   ├── stores/             # Svelte stores
│   │   └── game.ts         # Main game state store
│   ├── db.ts              # Database operations (API layer)
│   ├── engine.ts          # Game logic engine
│   ├── player.ts          # Player management
│   ├── supabaseClient.ts  # Legacy Supabase client (for auth)
│   └── types.ts           # TypeScript type definitions
├── routes/
│   ├── api/               # API endpoints (now using Drizzle)
│   │   ├── get-leaderboard/
│   │   ├── get-player-rank/
│   │   └── submit-score/
│   ├── play/              # Game page
│   └── +page.svelte       # Landing page
└── app.html               # HTML template
```

### Key Technologies

- **SvelteKit**: Full-stack web framework
- **TypeScript**: Type-safe JavaScript
- **Drizzle ORM**: Type-safe database ORM for PostgreSQL
- **Supabase**: Backend-as-a-Service for database hosting
- **Tailwind CSS**: Utility-first CSS framework
- **Skeleton UI**: Component library for Svelte
- **Chart.js**: Data visualization
- **Vercel**: Deployment platform (configured)

## 🎯 Game Features

### Core Mechanics
- **Event-driven narrative**: Quarterly events with meaningful choices
- **Resource management**: Balance multiple competing metrics
- **Procedural generation**: Seeded randomness for consistent experiences
- **Multiple endings**: Different outcomes based on player decisions
- **Score system**: Performance tracking with leaderboards

### Technical Features
- **Persistent game state**: Local storage with automatic save/load
- **Real-time leaderboards**: Global score tracking (when in remote mode)
- **Type-safe database operations**: Using Drizzle ORM with Supabase
- **Responsive design**: Works on desktop and mobile devices
- **Type safety**: Full TypeScript coverage
- **Performance optimized**: Efficient rendering and state management

## 🚀 Deployment

### Vercel (Recommended)

The project is pre-configured for Vercel deployment:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` 
   - `DATABASE_URL` (recommended)
   - `VITE_DATABASE_MODE=remote`
3. **Deploy** - Vercel will automatically build and deploy

### Manual Deployment

```bash
# Build the project
npm run build

# The built files will be in the .svelte-kit/output directory
# Deploy these files to your hosting provider
```

## 📝 Content Management

### Adding New Events

Events are stored in JSON files organized by year and quarter in `src/lib/content/events/`. Each event file contains:

```json
{
  "id": "unique-event-id",
  "headline": "Event Headline",
  "description": "Detailed event description that sets up the scenario and context for the player's decision...",
  "choices": [
    {
      "label": "Choice description",
      "details": "Detailed explanation of what this choice entails and its immediate consequences...",
      "wallstreet_analysis": "Analysis from a financial/investor perspective on this choice...",
      "ngo_analysis": "Analysis from an environmental/social responsibility perspective...",
      "researcher_analysis": "Analysis from a technical/research perspective on capability implications...",
      "effects": {
        "company": {
          "credits": "10..20",
          "revenue": "0..5",
          "valuation": "0..0",
          "approval": "-5..5",
          "security": "0..0",
          "alignment_confidence": "0..0"
        },
        "environment": {
          "social_stability": "-5..5",
          "cyber_bio_risk": "0..10",
          "climate_load": "-10..0"
        },
        "ai_capability": {
          "coding": "0..10",
          "hacking": "0..0",
          "bioweapons": "0..0",
          "politics_persuasion": "0..0",
          "robotics_embodied": "0..0",
          "research_taste": "0..0"
        }
      }
    }
  ],
  "year": 2025,
  "quarter": 4
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Ready to shape humanity's future?** Start the game and see if you can navigate the path to beneficial superintelligence! 🤖✨
