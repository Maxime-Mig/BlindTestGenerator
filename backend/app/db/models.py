from sqlalchemy import Column, Integer, String, Float
from .database import Base

class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    artist = Column(String, index=True)
    genre = Column(String, index=True, nullable=True)
    file_path = Column(String, unique=True, index=True)
    duration = Column(Float, nullable=True)
