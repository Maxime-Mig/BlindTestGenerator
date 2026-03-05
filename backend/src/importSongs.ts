import fs from 'fs';
import path from 'path';
import { addTrack, clearTracks } from './database';

const AUDIO_DIR = path.join(__dirname, '../public/audio');

function scanDirectory(dir: string, parentTheme: string = '') {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            // Build nested theme: "Parent - Child"
            const currentTheme = parentTheme ? `${parentTheme} - ${file}` : file;
            scanDirectory(fullPath, currentTheme);
        } else if (file.endsWith('.mp3')) {
            const theme = parentTheme || 'Inconnu';
            const filename = file.replace('.mp3', '');
            const parts = filename.split('_');

            let title = '';
            let answer = '';

            if (parts.length >= 2) {
                // We have at least Work and Title
                const formatStr = (s: string) => s
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase
                    .replace(/([a-zA-Z])(\d+)/g, '$1 $2') // LetterNumber
                    .replace(/_/g, ' ')
                    .trim();

                const work = formatStr(parts[0]);
                const song = formatStr(parts[1]);
                const type = parts[2] ? formatStr(parts[2]) : '';

                answer = work; // The primary answer is the name of the work
                title = `${work} - ${song}${type ? ' (' + type + ')' : ''}`;
            } else {
                // Fallback for simple filenames
                title = filename
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                    .replace(/_/g, ' ')
                    .trim();
                answer = title;
            }

            const audio_url = '/audio/' + path.relative(AUDIO_DIR, fullPath).replace(/\\/g, '/');

            addTrack({
                title,
                answer,
                theme,
                difficulty: 'Moyen',
                audio_url,
                start_time: 0
            });
            console.log(`[IMPORT] ${theme} > ${title}`);
        }
    }
}

console.log("Cleaning database...");
clearTracks();

console.log(`Scanning audio directory: ${AUDIO_DIR}`);
if (fs.existsSync(AUDIO_DIR)) {
    scanDirectory(AUDIO_DIR);
    console.log("Import complete!");
} else {
    console.error("Audio directory not found! Please create 'public/audio'.");
}

process.exit(0);
