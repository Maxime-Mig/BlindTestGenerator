import os
import random
import shutil
from pydub import AudioSegment
from sqlalchemy.orm import Session
from ..db.models import Song

# Directory to store temporary clips
CLIPS_DIR = "backend/static/clips"
MUSIC_DIR = "music"

def scan_music_folder(db: Session, music_dir: str = MUSIC_DIR):
    """Scans the music directory and adds new songs to the DB."""
    if not os.path.exists(music_dir):
        os.makedirs(music_dir)
        return {"message": f"Created {music_dir}. Please add music files."}

    added_count = 0
    for root, _, files in os.walk(music_dir):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.ogg', '.flac')):
                file_path = os.path.join(root, file)
                
                # Check if already exists
                existing = db.query(Song).filter(Song.file_path == file_path).first()
                if existing:
                    continue

                # Simple metadata extraction (filename based for now if metadata fails)
                # In a real app, use mutagen for ID3 tags.
                # Assuming format "Artist - Title.mp3" or just filename as title
                filename = os.path.splitext(file)[0]
                if " - " in filename:
                    artist, title = filename.split(" - ", 1)
                else:
                    artist = "Unknown"
                    title = filename

                song = Song(
                    title=title.strip(),
                    artist=artist.strip(),
                    file_path=file_path
                )
                db.add(song)
                added_count += 1
    
    db.commit()
    return {"added": added_count}

def generate_clip(song: Song, clip_duration_ms: int = 15000):
    """Generates a random clip from the song and saves it to static/clips."""
    if not os.path.exists(CLIPS_DIR):
        os.makedirs(CLIPS_DIR)

    # Load audio
    try:
        audio = AudioSegment.from_file(song.file_path)
    except Exception as e:
        print(f"Error loading {song.file_path}: {e}")
        return None

    duration_ms = len(audio)
    if duration_ms <= clip_duration_ms:
        start_ms = 0
    else:
        start_ms = random.randint(0, duration_ms - clip_duration_ms)
    
    clip = audio[start_ms:start_ms + clip_duration_ms]
    
    # Output filename: song_id_random.mp3 to avoid caching issues
    clip_filename = f"clip_{song.id}_{random.randint(1000,9999)}.mp3"
    output_path = os.path.join(CLIPS_DIR, clip_filename)
    
    # Clean up old clips? (Optional: for now just overwrite or let them pile up in dev)
    # For a real app, use a cron job or cleanup logic.
    
    clip.export(output_path, format="mp3")
    
    # Return relative path for frontend
    return f"/static/clips/{clip_filename}"
