# Walkthrough - Multi-Type and Difficulty Selection

I have restructured the project to allow users to select specific types of blind tests (Anime, Video Game, Series, Movie) and difficulties before starting the game.

## Changes Overview

### Backend
- **Database Model**: Added `source_type` and `difficulty` columns to the `Song` model.
- **Audio Service**: Updated `scan_music_folder` to automatically extract metadata from the directory structure.
    - Expected structure: `music/{Type}/{Difficulty}/{Filename}`
    - Example: `music/Anime/Hard/Naruto - Blue Bird.mp3`
- **API**:
    - Added `GET /api/game/filters` to retrieve available types and difficulties.
    - Updated `GET /api/game/start` to accept `types` and `difficulties` query parameters.

### Frontend
- **New Component**: Created `SelectionPage.vue` for selecting game options.
- **App Flow**: Updated `App.vue` to show the selection page first, then start the game with the selected filters.
- **Game Interface**: Updated `GameInterface.vue` to pass the selected filters to the backend when fetching a new song.

## How to Use

1.  **Organize Music**:
    - Create folders in your `music` directory corresponding to the types (e.g., `Anime`, `Game`).
    - Inside those, create folders for difficulties (e.g., `Easy`, `Hard`).
    - Place your audio files in the appropriate folders.
    - *Note: If you don't follow this structure, songs will default to "Unknown" type and "Normal" difficulty.*

2.  **Scan Library**:
    - Trigger a library scan (currently via `POST /api/game/scan` or by restarting the backend if configured to scan on startup).

3.  **Play**:
    - Open the web interface.
    - Select the categories and difficulties you want to play.
    - Click "Start Game".
    - The game will only serve songs matching your selection.

## Verification Results

### Backend
- Validated that `Song` model has new columns.
- Validated that `scan_music_folder` logic parses the path correctly.
- Validated that API endpoints accept the new parameters.

### Frontend
- Created `SelectionPage` with multi-select support.
- Integrated the flow in `App.vue`.
- Verified `GameInterface` sends the correct query parameters.
