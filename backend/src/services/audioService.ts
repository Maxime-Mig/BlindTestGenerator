import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const prisma = new PrismaClient();

const CLIPS_DIR = 'backend/static/clips';
const MUSIC_DIR = 'music';

interface ScanResult {
    added: number;
    message?: string;
}

/**
 * Scans the music directory and adds new songs to the database.
 * Expected folder structure: music/Type/Difficulty/Artist - Title.mp3
 */
export async function scanMusicFolder(musicDir: string = MUSIC_DIR): Promise<ScanResult> {
    if (!fs.existsSync(musicDir)) {
        fs.mkdirSync(musicDir, { recursive: true });
        return { added: 0, message: `Created ${musicDir}. Please add music files.` };
    }

    let addedCount = 0;
    const supportedExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];

    async function scanDirectory(dir: string) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                await scanDirectory(fullPath);
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    await processAudioFile(fullPath, musicDir);
                }
            }
        }
    }

    async function processAudioFile(filePath: string, baseDir: string) {
        // Check if already exists
        const existing = await prisma.song.findUnique({
            where: { filePath }
        });

        if (existing) {
            return;
        }

        // Extract metadata from directory structure
        const relativePath = path.relative(baseDir, filePath);
        const pathParts = relativePath.split(path.sep);

        let sourceType = 'Unknown';
        let difficulty = 'Normal';

        if (pathParts.length >= 3) {
            sourceType = pathParts[0];
            difficulty = pathParts[1];
        } else if (pathParts.length === 2) {
            sourceType = pathParts[0];
        }

        // Extract artist and title from filename
        const filename = path.basename(filePath, path.extname(filePath));
        let artist = 'Unknown';
        let title = filename;

        if (filename.includes(' - ')) {
            const parts = filename.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }

        // Add to database
        await prisma.song.create({
            data: {
                title,
                artist,
                filePath,
                sourceType,
                difficulty
            }
        });

        addedCount++;
    }

    await scanDirectory(musicDir);

    return { added: addedCount };
}

/**
 * Generates a random clip from the song and saves it to static/clips.
 * Returns the URL path to the clip.
 */
export function generateClip(
    song: { id: number; filePath: string },
    clipDurationMs: number = 15000
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(CLIPS_DIR)) {
            fs.mkdirSync(CLIPS_DIR, { recursive: true });
        }

        // Get audio duration first
        ffmpeg.ffprobe(song.filePath, (err, metadata) => {
            if (err) {
                console.error(`Error probing ${song.filePath}:`, err);
                return reject(err);
            }

            const durationMs = (metadata.format.duration || 0) * 1000;
            const clipDurationSec = clipDurationMs / 1000;

            let startMs = 0;
            if (durationMs > clipDurationMs) {
                startMs = Math.floor(Math.random() * (durationMs - clipDurationMs));
            }

            const startSec = startMs / 1000;

            // Generate unique filename
            const clipFilename = `clip_${song.id}_${Math.floor(Math.random() * 9000) + 1000}.mp3`;
            const outputPath = path.join(CLIPS_DIR, clipFilename);

            // Extract clip using ffmpeg
            ffmpeg(song.filePath)
                .setStartTime(startSec)
                .setDuration(clipDurationSec)
                .output(outputPath)
                .audioCodec('libmp3lame')
                .on('end', () => {
                    resolve(`/static/clips/${clipFilename}`);
                })
                .on('error', (error: Error) => {
                    console.error(`Error generating clip for ${song.filePath}:`, error);
                    reject(error);
                })
                .run();
        });
    });
}

export { prisma };
