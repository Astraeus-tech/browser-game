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

The game supports both local and remote database modes. Create environment files in your project root:

### For Development (.env.local)

```bash
# Database Configuration (Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Database Mode (local/remote)
VITE_DATABASE_MODE=local
```

### For Production (.env.production)

```bash
# Database Configuration (Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Database Mode (local/remote)
VITE_DATABASE_MODE=remote
```

### Environment Variables Explained

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Your Supabase project URL | Yes (for remote mode) | - |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes (for remote mode) | - |
| `VITE_DATABASE_MODE` | Database mode: `local` or `remote` | No | `local` |

## 🗄️ Database Setup

### Supabase Configuration

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Create the scores table**:
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

3. **Configure Row Level Security (RLS)**:
   ```sql
   ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

   -- Allow public read access to scores
   CREATE POLICY "Allow public read access" ON scores
     FOR SELECT USING (true);

   -- Allow public insert access
   CREATE POLICY "Allow public insert access" ON scores
     FOR INSERT WITH CHECK (true);
   ```

4. **Get your credentials** from Supabase Dashboard:
   - Go to Settings → API
   - Copy your Project URL and anon/public key

### Database Modes

- **Local Mode** (`VITE_DATABASE_MODE=local`): Game runs without database connectivity. Scores are not persisted, and leaderboards are disabled.
- **Remote Mode** (`VITE_DATABASE_MODE=remote`): Full functionality with score submission and leaderboards via Supabase.

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
│   ├── stores/             # Svelte stores
│   │   └── game.ts         # Main game state store
│   ├── db.ts              # Database operations
│   ├── engine.ts          # Game logic engine
│   ├── player.ts          # Player management
│   ├── supabaseClient.ts  # Supabase client configuration
│   └── types.ts           # TypeScript type definitions
├── routes/
│   ├── api/               # API endpoints
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
- **Tailwind CSS**: Utility-first CSS framework
- **Skeleton UI**: Component library for Svelte
- **Supabase**: Backend-as-a-Service for database
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
- **Responsive design**: Works on desktop and mobile devices
- **Type safety**: Full TypeScript coverage
- **Performance optimized**: Efficient rendering and state management

## 🚀 Deployment

### Vercel (Recommended)

The project is pre-configured for Vercel deployment:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
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
