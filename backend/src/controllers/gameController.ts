import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { scanMusicFolder, generateClip } from '../services/audioService';

const prisma = new PrismaClient();

export const scanLibrary = async (req: Request, res: Response) => {
    try {
        const result = await scanMusicFolder();
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to scan library' });
    }
};

export const startRound = async (req: Request, res: Response) => {
    try {
        // Get random song
        const count = await prisma.song.count();
        if (count === 0) {
            return res.status(404).json({ error: 'No songs found. Please scan library first.' });
        }

        const skip = Math.floor(Math.random() * count);
        const song = await prisma.song.findFirst({
            skip: skip
        });

        if (!song) {
            return res.status(500).json({ error: 'Failed to fetch song' });
        }

        const clipUrl = await generateClip(song.id);
        if (!clipUrl) {
            return res.status(500).json({ error: 'Failed to generate clip' });
        }

        res.json({
            songId: song.id,
            clipUrl
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const checkGuess = async (req: Request, res: Response) => {
    try {
        const { songId, guess } = req.body;

        const song = await prisma.song.findUnique({
            where: { id: Number(songId) }
        });

        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        const isCorrect = song.title.toLowerCase().trim() === guess.toLowerCase().trim();

        res.json({
            correct: isCorrect,
            title: song.title,
            artist: song.artist
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
