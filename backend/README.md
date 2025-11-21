# Blind Test Generator - Backend (TypeScript)

This is the **TypeScript/Express** backend for the Blind Test Generator application.

## Tech Stack

- **Framework**: Express
- **Database**: Prisma + SQLite
- **Audio Processing**: fluent-ffmpeg
- **Language**: TypeScript

## Port Configuration

- **Backend runs on**: `http://localhost:8000`
- **Frontend expects**: `http://localhost:8000`

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Express application entry point
│   ├── routes/
│   │   └── gameRoutes.ts     # Game API endpoints
│   └── services/
│       └── audioService.ts   # Audio processing & database logic
├── prisma/
│   └── schema.prisma         # Prisma database schema
├── package.json              # Node.js dependencies
└── static/                   # Generated audio clips
```

## Setup

### Prerequisites

**FFmpeg must be installed on your system** for audio processing:
- Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use `winget install ffmpeg`
- Mac: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

### Installation

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Push database schema:
   ```bash
   npx prisma db push
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. The API will be available at `http://localhost:8000`

## API Endpoints

- `GET /health` - Health check
- `POST /api/game/scan` - Scan music library
- `GET /api/game/filters` - Get available types and difficulties
- `GET /api/game/start?types[]=...&difficulties[]=...` - Start a new round
- `POST /api/game/guess` - Submit a guess

## Music Directory Structure

Place your music files in the `music/` directory with this structure:

```
music/
├── Anime/
│   ├── Easy/
│   │   └── Artist - Title.mp3
│   ├── Normal/
│   └── Hard/
├── Game/
│   ├── Easy/
│   └── Normal/
└── Movie/
    └── Easy/
```

The folder structure determines the `sourceType` and `difficulty` for each song.

## Note on Archived Backends

- `archived_python_backend/` - Previous Python/FastAPI implementation
- `archived_nodejs_backend/` - Original Node.js files before migration

---

**Migration Date**: 2025-11-20
