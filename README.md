# Blind Test Generator (Node.js + Vue 3)

A modern, web-based blind test game that uses your local music library.

## Features
- 🎵 **Local Music Support**: Plays MP3/WAV/FLAC files from your `music` folder.
- ✂️ **Smart Clipping**: Automatically extracts random 15-second clips using `ffmpeg`.
- 🧠 **Guessing Game**: Type the title or artist to guess.
- 🎨 **Modern UI**: Built with Vue 3, TypeScript, and Tailwind CSS.

## Prerequisites
- **Node.js 16+**
- **FFmpeg**: Must be installed and in your system PATH.

## Installation

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma db push
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

3. **Add Music**
   - Create a folder named `music` in the root directory.
   - Add your MP3/WAV files there.

## Running the Application

1. **Start the Backend**
   ```bash
   cd backend
   npm run dev
   ```
   The API will run at `http://localhost:8000`.

2. **Start the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   The game will run at `http://localhost:5173`.

3. **Play!**
   - Open the frontend URL.
   - Click "Start Game".
   - If it's your first time, the game will attempt to scan your library.

## Architecture
- **Backend**: Node.js, Express, TypeScript, Prisma (SQLite).
- **Frontend**: Vue 3, TypeScript, Tailwind CSS, Vite.
- **Audio**: fluent-ffmpeg.