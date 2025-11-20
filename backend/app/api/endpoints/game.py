from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func
from ...db.database import get_db
from ...db.models import Song
from ...services import audio_service
from pydantic import BaseModel

router = APIRouter()

class GuessRequest(BaseModel):
    song_id: int
    guess: str

class GuessResponse(BaseModel):
    correct: bool
    title: str
    artist: str

@router.post("/scan")
def scan_library(db: Session = Depends(get_db)):
    """Scans the music directory for new songs."""
    return audio_service.scan_music_folder(db)

@router.get("/start")
def start_round(db: Session = Depends(get_db)):
    """Starts a new round by picking a random song and generating a clip."""
    # Get random song
    song = db.query(Song).order_by(func.random()).first()
    if not song:
        raise HTTPException(status_code=404, detail="No songs found. Please scan library first.")
    
    clip_url = audio_service.generate_clip(song)
    if not clip_url:
        raise HTTPException(status_code=500, detail="Failed to generate clip.")
    
    return {
        "song_id": song.id,
        "clip_url": clip_url
    }

@router.post("/guess/{song_id}")
def submit_guess(song_id: int, guess: str = "", db: Session = Depends(get_db)):
    """
    Validates the guess. 
    For this simple version, we just return the correct answer so the frontend can show it.
    In a real game, we'd do fuzzy matching here.
    """
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Simple exact match check (case insensitive) - can be improved
    is_correct = guess.lower().strip() == song.title.lower().strip()
    
    return {
        "correct": is_correct,
        "title": song.title,
        "artist": song.artist,
        "file_path": song.file_path
    }
