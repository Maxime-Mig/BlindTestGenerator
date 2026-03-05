import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Normalizes an audio file using ffmpeg's loudnorm filter.
 * Target: -14 LUFS (Integrated), -1.0 dBTP (True Peak), 11 LU (Loudness Range)
 */
function normalizeFile(filePath: string) {
    const tempPath = filePath + '.tmp.mp3';
    try {
        console.log(`         🔊 Normalizing: ${path.basename(filePath)}`);

        // Single-pass loudnorm (standard for web/streaming)
        const cmd = `ffmpeg -i "${filePath}" -af "loudnorm=I=-14:TP=-1.0:LRA=11" -ar 44100 -b:a 64k -y "${tempPath}" 2>&1`;

        execSync(cmd, { stdio: 'pipe' });

        // Replace original with normalized version
        fs.renameSync(tempPath, filePath);
        console.log(`         ✅ Normalized.`);
    } catch (err: any) {
        console.error(`         ❌ Normalization failed for ${filePath}:`, err.message);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
}

function scanAndNormalize(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanAndNormalize(fullPath);
        } else if (item.toLowerCase().endsWith('.mp3')) {
            normalizeFile(fullPath);
        }
    }
}

const audioDir = path.join(__dirname, '../../public/audio');

console.log('🚀 Starting Audio Normalization...');
if (!fs.existsSync(audioDir)) {
    console.error(`Error: Audio directory not found at ${audioDir}`);
    process.exit(1);
}

scanAndNormalize(audioDir);
console.log('\n✨ All tracks normalized!');
