import { addTrack, clearTracks } from './database';
import * as path from 'path';
import * as fs from 'fs';

const initialTracks = [
    {
        title: "Oshi no Ko - Serenade - Ending 3",
        answer: JSON.stringify(["Oshi no Ko - Serenade", "Oshi no Ko"]),
        theme: "Anime", difficulty: "Moyen",
        audio_url: "/audio/Anime/OshiNoKo_Serenade_ending3.mp3",
        start_time: 0
    },
    {
        title: "Skyrim - Dovahkiin",
        answer: JSON.stringify(["Skyrim", "The Elder Scrolls V", "Skyrim - Dovahkiin"]),
        theme: "Jeux Vidéo", difficulty: "Facile",
        audio_url: "/audio/JeuxVideo/Skyrim_Dovahkiin.mp3",
        start_time: 0
    },
    {
        title: "Oiiaoiia Cat X After Dark",
        answer: JSON.stringify(["Oiiaoiia Cat X After Dark", "Oiiaoiia Cat", "After Dark", "Oiia After Dark"]),
        theme: "Musique", difficulty: "Difficile",
        audio_url: "/audio/Musique/OiiaoiiaCatXAfterDark.mp3",
        start_time: 0
    }
];

// If scraped_tracks.json exists at root of backend, use it instead
const scrapedJsonPath = path.join(__dirname, '../scraped_tracks.json');
let tracks = initialTracks;
if (fs.existsSync(scrapedJsonPath)) {
    const raw = fs.readFileSync(scrapedJsonPath, 'utf-8');
    const scraped = JSON.parse(raw);
    if (Array.isArray(scraped) && scraped.length > 0) {
        tracks = scraped;
        console.log(`📄 Using scraped_tracks.json (${scraped.length} tracks)`);
    }
} else {
    console.log('📄 Using hardcoded initial tracks (no scraped_tracks.json found)');
}

console.log('Cleaning database...');
clearTracks();

console.log('Importing tracks...');
tracks.forEach((track: any) => {
    addTrack(track);
    console.log(`  - Added: ${track.title}`);
});

console.log(`\nImport complete! (${tracks.length} tracks added)`);
process.exit(0);
