"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const AUDIO_DIR = path_1.default.join(__dirname, '../public/audio');
function scanDirectory(dir, theme = 'Inconnu') {
    const files = fs_1.default.readdirSync(dir);
    for (const file of files) {
        const fullPath = path_1.default.join(dir, file);
        const stats = fs_1.default.statSync(fullPath);
        if (stats.isDirectory()) {
            // New folder = New theme (recursive)
            scanDirectory(fullPath, file);
        }
        else if (file.endsWith('.mp3')) {
            // New track found: nomDeLOeuvre_TitreDeLaMusque_Opening/ending.mp3
            const filename = file.replace('.mp3', '');
            const parts = filename.split('_');
            let title = '';
            let answer = '';
            if (parts.length >= 2) {
                // We have at least Work and Title
                const formatStr = (s) => s
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase
                    .replace(/([a-zA-Z])(\d+)/g, '$1 $2') // LetterNumber
                    .replace(/_/g, ' ')
                    .trim();
                const work = formatStr(parts[0]);
                const song = formatStr(parts[1]);
                const type = parts[2] ? formatStr(parts[2]) : '';
                answer = work; // The primary answer is the name of the work
                title = `${work} - ${song}${type ? ' (' + type + ')' : ''}`;
            }
            else {
                // Fallback for simple filenames
                title = filename
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                    .replace(/_/g, ' ')
                    .trim();
                answer = title;
            }
            const audio_url = '/audio/' + path_1.default.relative(AUDIO_DIR, fullPath).replace(/\\/g, '/');
            (0, database_1.addTrack)({
                title,
                answer,
                theme,
                difficulty: 'Moyen',
                audio_url
            });
            console.log(`[IMPORT] ${theme} > ${title}`);
        }
    }
}
console.log("Cleaning database...");
(0, database_1.clearTracks)();
console.log(`Scanning audio directory: ${AUDIO_DIR}`);
if (fs_1.default.existsSync(AUDIO_DIR)) {
    scanDirectory(AUDIO_DIR);
    console.log("Import complete!");
}
else {
    console.error("Audio directory not found! Please create 'public/audio'.");
}
process.exit(0);
