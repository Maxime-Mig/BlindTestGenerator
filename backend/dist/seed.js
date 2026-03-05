"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const initialTracks = [
    {
        title: "Oshi no Ko - Idol - Opening 1",
        answer: JSON.stringify(["Oshi no Ko - Idol", "Oshi no Ko"]),
        theme: "Anime", difficulty: "Moyen",
        audio_url: "/audio/Anime/OshiNoKo_Serenade_ending3.mp3"
    },
    {
        title: "Skyrim - Dragonborn Theme",
        answer: JSON.stringify(["Skyrim", "The Elder Scrolls V", "The Elder Scrolls V - Dragonborn Theme"]),
        theme: "Jeux Vidéo", difficulty: "Facile",
        audio_url: "/audio/JeuxVideo/Skyrim_Dovahkiin.mp3"
    },
    {
        title: "Oiiaoiia Cat X After Dark",
        answer: JSON.stringify(["Oiiaoiia Cat X After Dark", "Oiia After Dark", "After Dark"]),
        theme: "Musique", difficulty: "Difficile",
        audio_url: "/audio/Musique/OiiaoiiaCatXAfterDark.mp3"
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
}
else {
    console.log('📄 Using hardcoded initial tracks (no scraped_tracks.json found)');
}
console.log('Cleaning database...');
(0, database_1.clearTracks)();
console.log('Importing tracks...');
tracks.forEach((track) => {
    (0, database_1.addTrack)(track);
    console.log(`  - Added: ${track.title}`);
});
console.log(`\nImport complete! (${tracks.length} tracks added)`);
process.exit(0);
