import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLIPS_DIR = path.join(__dirname, '../../public/clips');
const MUSIC_DIR = path.join(__dirname, '../../../music');

// Ensure clips directory exists
if (!fs.existsSync(CLIPS_DIR)) {
    fs.mkdirSync(CLIPS_DIR, { recursive: true });
}

export const scanMusicFolder = async () => {
    if (!fs.existsSync(MUSIC_DIR)) {
        fs.mkdirSync(MUSIC_DIR, { recursive: true });
        return { message: `Created ${MUSIC_DIR}. Please add music files.` };
    }

    let addedCount = 0;

    const files = fs.readdirSync(MUSIC_DIR);

    for (const file of files) {
        if (file.match(/\.(mp3|wav|ogg|flac)$/i)) {
            const filePath = path.join(MUSIC_DIR, file);

            // Check if exists
            const existing = await prisma.song.findUnique({
                where: { filePath }
            });

            if (existing) continue;

            // Simple metadata from filename
            // Format: "Artist - Title.mp3" or "Title.mp3"
            const filename = path.parse(file).name;
            let artist = "Unknown";
            let title = filename;

            if (filename.includes(" - ")) {
                const parts = filename.split(" - ");
                artist = parts[0].trim();
                title = parts.slice(1).join(" - ").trim();
            }

            // Get duration (optional, skipping for speed or need ffprobe)

            await prisma.song.create({
                data: {
                    title,
                    artist,
                    filePath
                }
            });
            addedCount++;
        }
    }

    return { added: addedCount };
};

export const generateClip = async (songId: number): Promise<string | null> => {
    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) return null;

    return new Promise((resolve, reject) => {
        // Get duration using ffprobe
        ffmpeg.ffprobe(song.filePath, (err, metadata) => {
            if (err) {
                console.error("Error probing file:", err);
                resolve(null);
                return;
            }

            const duration = metadata.format.duration || 0;
            const clipDuration = 15; // seconds

            let startTime = 0;
            if (duration > clipDuration) {
                startTime = Math.floor(Math.random() * (duration - clipDuration));
            }

            const clipFilename = `clip_${song.id}_${Date.now()}.mp3`;
            const outputPath = path.join(CLIPS_DIR, clipFilename);

            ffmpeg(song.filePath)
                .setStartTime(startTime)
                .setDuration(clipDuration)
                .output(outputPath)
                .on('end', () => {
                    resolve(`/clips/${clipFilename}`);
                })
                .on('error', (err) => {
                    console.error("Error generating clip:", err);
                    resolve(null);
                })
                .run();
        });
    });
};
