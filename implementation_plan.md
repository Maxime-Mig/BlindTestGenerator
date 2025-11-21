# Implementation Plan - Restructure for Multi-Type and Difficulty Selection

The goal is to allow users to select specific types of blind tests (Anime, Video Game, Series, Movie, etc.) and difficulties before starting the game. The user should be able to select multiple types and difficulties.

## User Review Required

> [!IMPORTANT]
> **Data Organization Assumption**: I will assume that the music files are organized in directories to infer `type` and `difficulty`.
> Proposed structure: `music/{type}/{difficulty}/{filename}`.
> Example: `music/Anime/Hard/Naruto - Blue Bird.mp3`.
> If a folder level is missing, it will default to "Unknown" or "Normal".
> **Database Migration**: Since we are using `Base.metadata.create_all`, adding columns might require dropping the table or manually adding columns if we don't have a migration tool like Alembic set up. I will assume for this task that it's okay to drop the database (it's a local SQLite likely) or I'll just add the columns if they don't exist. **I will check if `alembic` is used, otherwise I might need to reset the DB.**

## Proposed Changes

### Backend

#### [MODIFY] [models.py](file:///d:/Projet/BlindTestGenerator/backend/app/db/models.py)
- Add `source_type` (String) and `difficulty` (String) columns to `Song` model.

#### [MODIFY] [audio_service.py](file:///d:/Projet/BlindTestGenerator/backend/app/services/audio_service.py)
- Update `scan_music_folder` to parse `source_type` and `difficulty` from the file path relative to the music directory.
- Logic: `music_dir/<source_type>/<difficulty>/<song_file>` or `music_dir/<source_type>/<song_file>` (default difficulty).

#### [MODIFY] [game.py](file:///d:/Projet/BlindTestGenerator/backend/app/api/endpoints/game.py)
- Update `start_round` to accept `types` (List[str]) and `difficulties` (List[str]) as query parameters.
- Filter songs based on these parameters.
- Add `GET /filters` endpoint to return available types and difficulties from the database.

### Frontend

#### [NEW] [SelectionPage.vue](file:///d:/Projet/BlindTestGenerator/frontend/src/components/SelectionPage.vue)
- A new component to display checkboxes/toggles for available Types and Difficulties.
- Fetches options from `GET /filters` (or derived from a hardcoded list if empty).
- "Start Game" button emits selected options.

#### [MODIFY] [App.vue](file:///d:/Projet/BlindTestGenerator/frontend/src/App.vue)
- Replace the simple "Start Game" button with `SelectionPage` component.
- Store selected filters in state.
- Pass filters to `GameInterface`.

#### [MODIFY] [GameInterface.vue](file:///d:/Projet/BlindTestGenerator/frontend/src/components/GameInterface.vue)
- Accept `filters` prop.
- Pass `filters` to the API call when starting a round.

## Verification Plan

### Automated Tests
- I will run the backend server and frontend dev server.
- I will use `curl` or browser to check `GET /api/game/filters`.
- I will use `curl` to check `GET /api/game/start?types=Anime&difficulties=Hard`.

### Manual Verification
1.  **Setup**: Create a folder structure `music/Anime/Hard` and put a dummy MP3 file there.
2.  **Scan**: Trigger a scan (via API or restart if it scans on startup - currently it's an API endpoint `/scan`).
3.  **UI**: Open the frontend.
4.  **Selection**: Verify `SelectionPage` shows "Anime" and "Hard".
5.  **Play**: Select "Anime" and "Hard", click Start.
6.  **Verify**: The game starts and plays the song from that folder.
