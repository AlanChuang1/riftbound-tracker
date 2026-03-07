# Riftbound Tracker

A mobile/desktop PWA for tracking your Riftbound (League of Legends TCG) card collection, building decks, and scanning physical cards.

**Live:** [riftbound-tracker-five.vercel.app](https://riftbound-tracker-five.vercel.app)

## Features

- **Card Browser** — Search and filter all 582+ Riftbound cards by name, faction, type, and rarity
- **Collection Manager** — Track which cards you own with quantity controls
- **Card Scanner** — Use your device camera to scan physical cards and add them to your collection via AI image recognition
- **Deck Builder** — Build and manage decks with a card search interface
- **AI Deck Advisor** — Get AI-powered deck improvement suggestions from your collection or general advice
- **PWA** — Install as an app on mobile or desktop

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon) + Prisma 7
- **Auth:** NextAuth v4 (email/password)
- **AI:** Google Gemini (gemini-2.5-flash) for card scanning and deck advice
- **Card Data:** [Riftcodex API](https://api.riftcodex.com)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js >= 20
- Docker (for local PostgreSQL) or a Neon account

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/AlanChuang1/riftbound-tracker.git
   cd riftbound-tracker
   npm install
   ```

2. Create a `.env` file (see `.env.example` for reference):
   ```
   DATABASE_URL=postgresql://...
   DIRECT_URL=postgresql://...
   GEMINI_API_KEY=your_key
   NEXTAUTH_SECRET=your_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

3. Start the local database (or use Neon):
   ```bash
   docker compose up -d
   ```

4. Run migrations and seed the card catalog:
   ```bash
   npm run db:migrate
   npm run seed
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run seed` | Seed card data from Riftcodex API |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
