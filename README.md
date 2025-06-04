# Singularity Run Game

An AI strategy game where you lead humanity's future as the CEO of an AI startup on the brink of creating the most powerful artificial intelligence in history. Navigate the complex landscape of AI development while balancing corporate interests, technological advancement, and global stability.

## 🎮 Game Overview

**Singularity Run** is a text-based strategy game built with SvelteKit that simulates the challenges of AI development in a near-future scenario. Players make critical decisions that impact:

- **Company Metrics**: Credits, revenue, valuation, approval, security, and alignment confidence
- **Environmental Factors**: Social stability, cyber/bio risks, and climate impact
- **AI Capabilities**: Coding, hacking, bioweapons, politics/persuasion, robotics, and research capabilities

The game features a dynamic event system spanning from 2025 to 2027, with quarterly decision points that shape the narrative and determine multiple possible endings.

### Game Architecture

The game features server-authoritative gameplay with anti-cheat protection, persistent game states, and real-time score submission. All game logic is validated server-side to ensure fair play and consistent experiences across all players.

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

The game uses **Drizzle ORM** for type-safe database operations with Supabase for persistent gameplay and leaderboards.

### For Development (.env.local)

```bash
# Database Configuration (Postgres with Drizzle ORM)
POSTGRES_PRISMA_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
POSTGRES_URL_NON_POOLING=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Alternative: Supabase credentials (for fallback)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Database Mode 
VITE_DATABASE_MODE=remote
```

### For Production (.env.production)

```bash
# Database Configuration (Postgres with Drizzle ORM)
POSTGRES_PRISMA_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
POSTGRES_URL_NON_POOLING=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Alternative: Supabase credentials (for fallback)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Database Mode
VITE_DATABASE_MODE=remote
```

### Environment Variables Explained

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `POSTGRES_PRISMA_URL` | PostgreSQL connection string for runtime | Recommended | - |
| `POSTGRES_URL_NON_POOLING` | PostgreSQL connection string for migrations | Required for migrations | - |
| `SUPABASE_URL` | Your Supabase project URL | Fallback option | - |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | Fallback option | - |
| `VITE_DATABASE_MODE` | Database mode | No | `remote` |

## 🗄️ Database Setup with Drizzle ORM

### Why Drizzle ORM?

This project uses **Drizzle ORM** for several benefits:
- **Type Safety**: Full TypeScript support with inferred types
- **Performance**: Optimized queries and better connection pooling
- **Developer Experience**: Intuitive query builder and schema management
- **Migration Management**: Version-controlled database schema changes
- **Supabase Compatible**: Works seamlessly with Supabase's PostgreSQL

### Database Schema

The game uses two main tables:

1. **`scores`**: Stores player scores with ranking optimization
   - `player_id`: UUID for player identification
   - `game_id`: Links to specific game sessions
   - `score`: Final game score
   - `display_name`: Player's chosen display name
   - `run_ts`: Timestamp of the game run

2. **`game_actions`**: Server-authoritative game state management
   - Stores complete game states and action history
   - Enables anti-cheat validation and game replay
   - Supports concurrent game sessions per player

### Supabase Configuration

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Get your database credentials**:
   - Go to Settings → Database
   - Copy the connection string from the "Connection Pooler" section
   - Use "Transaction" mode for better compatibility with Drizzle

3. **Run database migrations**:
   ```bash
   npm run db:push  # For development
   # OR
   npm run db:migrate  # For production
   ```

4. **Configure Row Level Security (RLS)**:
   ```sql
   ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
   ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;

   -- Allow public read access to scores
   CREATE POLICY "Allow public read access" ON scores
     FOR SELECT USING (true);

   -- Allow public insert access
   CREATE POLICY "Allow public insert access" ON scores
     FOR INSERT WITH CHECK (true);

   -- Allow users to manage their own game sessions
   CREATE POLICY "Users manage own games" ON game_actions
     FOR ALL USING (true);
   ```

### Database Operations with Drizzle

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

### Database Configuration

The game requires a Supabase database connection for server-authoritative gameplay with full persistence, score tracking, and leaderboards.

## 🎯 Game Structure & Mechanics

### Core Game Loop

1. **Quarterly Events**: Players face events each quarter from Q3 2025 through 2027
2. **Choice Selection**: Each event presents 2-3 strategic choices with detailed analysis
3. **Resource Management**: Choices affect 16 different meters across 3 categories
4. **Progression**: Game advances through time with escalating complexity
5. **Multiple Endings**: Different outcomes based on final meter states and decisions

### Meter System

The game tracks three categories of meters:

#### Company Metrics
- **Credits**: Financial resources for operations
- **Revenue**: Income generation capability  
- **Valuation**: Company market value
- **Approval**: Public and investor confidence
- **Security**: Cybersecurity and data protection
- **Alignment Confidence**: Trust in AI safety measures

#### Environment Metrics  
- **Social Stability**: Societal cohesion and order
- **Cyber/Bio Risk**: Technological and biological threats
- **Climate Load**: Environmental impact and sustainability

#### AI Capability Metrics
- **Coding**: Programming and software development capability
- **Hacking**: Cybersecurity and intrusion capabilities
- **Bioweapons**: Biological threat potential (monitored for safety)
- **Politics/Persuasion**: Influence and communication capabilities
- **Robotics/Embodied**: Physical world interaction capabilities
- **Research Taste**: Scientific research and discovery capabilities

### Event System

Events are stored as JSON files organized by year and quarter:

```
src/lib/content/events/
├── 2025/
│   ├── Q3/  # Game start period
│   └── Q4/
├── 2026/
│   ├── Q1/
│   ├── Q2/
│   ├── Q3/
│   └── Q4/
└── 2027/
    ├── Q1/
    ├── Q2/
    ├── Q3/
    └── Q4/  # Potential game end
```

Each event includes:
- **Narrative description** setting up the scenario
- **Multiple choice options** with detailed consequences
- **Expert analysis** from Wall Street, NGO, and researcher perspectives
- **Meter effects** specified as ranges (e.g., "10..20" credits)
- **Dynamic scaling** based on game progression

### Scoring System

The final score calculation includes:

1. **Base Points**:
   - Progression: 50 points per quarter survived
   - Company metrics: Weighted sum of all company meters
   - Environment metrics: Weighted environmental impact
   - AI capabilities: Weighted capability development

2. **Bonuses**:
   - Win condition: +1000 points
   - Specific ending achievements

3. **Multipliers**:
   - Ending rank (S/A/B): 2.0x/1.5x/1.2x
   - Outcome type: Loss 0.5x, Draw 0.8x, Win 1.0x

### Ending System

Games can end through multiple conditions:
- **Win**: Successfully navigating to beneficial AGI
- **Loss**: Critical failure (bankruptcy, security breach, etc.)
- **Draw**: Survival without decisive outcome
- **Auto-triggers**: Running out of credits or time

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
│   │   ├── ResourceBars.svelte      # Meter visualization
│   │   ├── TypewriterText.svelte    # Animated text display
│   │   └── DisplayNameModal.svelte  # Player name input
│   ├── content/            # Game content and data
│   │   └── events/         # Event definitions by year/quarter
│   │       ├── 2025/Q3/    # Starting events
│   │       ├── 2025/Q4/
│   │       ├── 2026/       # Mid-game progression
│   │       └── 2027/       # End-game scenarios
│   ├── db/                 # Database layer (Drizzle ORM)
│   │   ├── schema.ts       # Database schema definitions
│   │   ├── serverGame.ts   # Server-side game management
│   │   └── index.ts        # Database client configuration
│   ├── stores/             # Svelte stores
│   │   └── game.ts         # Main game state store
│   ├── engine.ts          # Game logic engine
│   ├── secureGameClient.ts # Server-authoritative game client
│   ├── gameClient.ts      # Legacy client-side game logic
│   ├── gameStateManager.ts # State synchronization
│   ├── player.ts          # Player management
│   ├── rng.ts             # Seeded random number generation
│   ├── impact.ts          # Meter impact calculations
│   └── types.ts           # TypeScript type definitions
├── routes/
│   ├── api/               # Server API endpoints
│   │   ├── game/          # Game management endpoints
│   │   │   ├── start/     # Start new game session
│   │   │   ├── choose/    # Process player choices
│   │   │   └── status/    # Game state queries
│   │   ├── get-leaderboard/    # Score leaderboards
│   │   ├── get-player-rank/    # Individual rankings
│   │   └── debug-*/       # Development debugging tools
│   ├── play/              # Main game interface
│   ├── secure-play/       # Server-authoritative game mode
│   └── +page.svelte       # Landing page
└── app.html               # HTML template
```

### Key Technologies

- **SvelteKit**: Full-stack web framework with server-side rendering
- **TypeScript**: Type-safe JavaScript with full coverage
- **Drizzle ORM**: Type-safe database ORM for PostgreSQL
- **Supabase**: Backend-as-a-Service for database hosting
- **Tailwind CSS**: Utility-first CSS framework
- **Skeleton UI**: Component library for Svelte
- **Chart.js**: Data visualization for score trends
- **Vercel**: Deployment platform with SvelteKit adapter (pre-configured)
- **Vercel Analytics**: Performance and usage tracking

## 🎯 Game Features

### Core Mechanics
- **Event-driven narrative**: Quarterly decision points with meaningful consequences
- **Resource management**: Balance 16 competing metrics across 3 categories
- **Procedural generation**: Seeded randomness for consistent yet varied experiences
- **Multiple endings**: 20+ different outcomes based on player decisions and final state
- **Score system**: Comprehensive performance tracking with global leaderboards
- **Expert analysis**: Multiple perspectives on each choice (financial, ethical, technical)

### Technical Features
- **Server-authoritative gameplay**: Anti-cheat protection with validated game states
- **Real-time leaderboards**: Global score tracking with player rankings
- **Persistent game sessions**: Resume games across browser sessions
- **Type-safe database operations**: Full TypeScript coverage with Drizzle ORM
- **Responsive design**: Optimized for desktop and mobile devices
- **Performance optimized**: Efficient rendering and state management
- **Development tools**: Debug endpoints for testing game mechanics

### Accessibility Features
- **Keyboard navigation**: Full game playable without mouse
- **Screen reader support**: Semantic HTML and ARIA labels
- **High contrast mode**: Support for accessibility preferences
- **Scalable text**: Responsive design accommodates text scaling

## 🚀 Deployment

### Vercel (Recommended)

The project is designed for easy deployment on Vercel and comes pre-configured with the **SvelteKit Vercel adapter** (`@sveltejs/adapter-vercel`). This makes deployment seamless with zero additional configuration needed.

**Simple Deployment Steps:**

1. **Connect your repository** to Vercel (GitHub/GitLab integration)
2. **Set environment variables** in Vercel dashboard:
   - `POSTGRES_PRISMA_URL` (recommended)
   - `POSTGRES_URL_NON_POOLING` (required for migrations)
   - `SUPABASE_URL` (fallback)
   - `SUPABASE_ANON_KEY` (fallback)
   - `VITE_DATABASE_MODE=remote`
3. **Deploy** - Vercel automatically detects SvelteKit and deploys with optimal settings

**Why Vercel?**
- **Zero Configuration**: The SvelteKit Vercel adapter handles all build optimizations
- **Edge Functions**: Server-side API routes deploy as optimized edge functions
- **Automatic Scaling**: Handles traffic spikes automatically
- **Preview Deployments**: Every commit gets a preview URL for testing

### Manual Deployment

```bash
# Build the project
npm run build

# The built files will be in the .svelte-kit/output directory
# Deploy these files to your hosting provider
```

### Environment-Specific Configuration

The game is designed for server-authoritative gameplay with persistent database connectivity. Set `VITE_DATABASE_MODE=remote` to enable full functionality including score tracking and leaderboards.

**Deployment Note**: The project uses `@sveltejs/adapter-vercel` for seamless Vercel deployment, automatically optimizing the build for Vercel's edge network and serverless functions.

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

### Content Guidelines

- **Narrative Consistency**: Events should feel like a cohesive story progression
- **Balanced Choices**: Each choice should have meaningful trade-offs
- **Expert Perspectives**: Include realistic analysis from different viewpoints
- **Meter Balance**: Ensure events don't trivially break game balance
- **Temporal Logic**: Events should make sense for their time period

### Testing New Content

```bash
# Start development server with debug mode
npm run dev

# Use debug endpoints to test specific events
curl -X POST http://localhost:5173/api/debug-game-state \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "quarter": 4}'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

1. **Content Changes**: Modify JSON files in `src/lib/content/events/`
2. **Game Logic**: Update TypeScript files in `src/lib/`
3. **Database Changes**: Modify schema in `src/lib/db/schema.ts` and run migrations
4. **UI Changes**: Update Svelte components and routes
5. **Testing**: Use debug endpoints and local development environment

### Code Standards

- **TypeScript**: Full type coverage required
- **ESLint**: Follow configured linting rules
- **Prettier**: Automatic code formatting
- **Svelte**: Follow Svelte best practices for components

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to shape humanity's future?** Start the game and see if you can navigate the path to beneficial superintelligence! 🤖✨

*Choose your path wisely - every decision echoes through time, and the future of human-AI collaboration rests in your hands.*
