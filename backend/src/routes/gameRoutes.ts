import { Router, Request, Response } from 'express';
import { prisma, scanMusicFolder, generateClip } from '../services/audioService';

const router = Router();

/**
 * POST /api/game/scan
 * Scans the music directory for new songs
 */
router.post('/scan', async (req: Request, res: Response) => {
    try {
        const result = await scanMusicFolder();
        res.json(result);
    } catch (error) {
        console.error('Error scanning music folder:', error);
        res.status(500).json({ error: 'Failed to scan music folder' });
    }
});

/**
 * GET /api/game/filters
 * Returns available types and difficulties
 */
router.get('/filters', async (req: Request, res: Response) => {
    try {
        const songs = await prisma.song.findMany({
            select: {
                sourceType: true,
                difficulty: true
            }
        });

        const types = [...new Set(songs.map(s => s.sourceType).filter(Boolean))];
        const difficulties = [...new Set(songs.map(s => s.difficulty).filter(Boolean))];

        res.json({ types, difficulties });
    } catch (error) {
        console.error('Error fetching filters:', error);
        res.status(500).json({ error: 'Failed to fetch filters' });
    }
});

/**
 * GET /api/game/start
 * Starts a new round by picking a random song and generating a clip
 * Query params: types[], difficulties[]
 */
router.get('/start', async (req: Request, res: Response) => {
    try {
        const types = req.query.types ? (Array.isArray(req.query.types) ? req.query.types : [req.query.types]) : [];
        const difficulties = req.query.difficulties ? (Array.isArray(req.query.difficulties) ? req.query.difficulties : [req.query.difficulties]) : [];

        // Build query
        const where: any = {};

        if (types.length > 0) {
            where.sourceType = { in: types as string[] };
        }

        if (difficulties.length > 0) {
            where.difficulty = { in: difficulties as string[] };
        }

        // Get random song
        const count = await prisma.song.count({ where });

        if (count === 0) {
            return res.status(404).json({ error: 'No songs found. Please scan library first.' });
        }

        const skip = Math.floor(Math.random() * count);
        const song = await prisma.song.findFirst({
            where,
            skip
        });

        if (!song) {
            return res.status(404).json({ error: 'No songs found.' });
        }

        // Generate clip
        const clipUrl = await generateClip(song);

        res.json({
            songId: song.id,
            clipUrl
        });
    } catch (error) {
        console.error('Error starting round:', error);
        res.status(500).json({ error: 'Failed to start round' });
    }
});

/**
 * POST /api/game/guess
 * Validates the guess and returns the correct answer
 * Body: { songId: number, guess: string }
 */
router.post('/guess', async (req: Request, res: Response) => {
    try {
        const { songId, guess } = req.body;

        if (!songId) {
            return res.status(400).json({ error: 'songId is required' });
        }

        const song = await prisma.song.findUnique({
            where: { id: Number(songId) }
        });

        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        // Simple exact match check (case insensitive)
        const isCorrect = guess?.toLowerCase().trim() === song.title.toLowerCase().trim();

        res.json({
            correct: isCorrect,
            title: song.title,
            artist: song.artist,
            filePath: song.filePath
        });
    } catch (error) {
        console.error('Error submitting guess:', error);
        res.status(500).json({ error: 'Failed to submit guess' });
    }
});

export default router;
