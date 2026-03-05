"use strict";
/**
 * BlindTest Music Scraper
 * Usage: npx ts-node src/scripts/scraper.ts <PLAYLIST_URL> <THEME> <DIFFICULTY>
 *
 * Examples:
 *   npx ts-node src/scripts/scraper.ts "https://youtube.com/playlist?list=..." "Anime" "Moyen"
 *   npx ts-node src/scripts/scraper.ts "https://youtube.com/playlist?list=..." "Jeux Vidéo" "Facile"
 *
 * Output:
 *   - Downloads .mp3 files to: public/audio/<THEME>/
 *   - Generates: scraped_tracks.json (review & edit this before running seed)
 *
 * Afterwards:
 *   npx ts-node src/seed.ts  (loads scraped_tracks.json instead of hardcoded tracks)
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const youtube_dl_exec_1 = __importDefault(require("youtube-dl-exec"));
// ─── Args ──────────────────────────────────────────────────────────────────────
const [, , PLAYLIST_URL, THEME = 'Musique', DIFFICULTY = 'Moyen'] = process.argv;
if (!PLAYLIST_URL) {
    console.error('Usage: npx ts-node src/scripts/scraper.ts <PLAYLIST_URL> <THEME> <DIFFICULTY>');
    process.exit(1);
}
// ─── Paths ────────────────────────────────────────────────────────────────────
const outputDir = path.join(__dirname, '../../public/audio', THEME);
const jsonOutput = path.join(__dirname, '../../scraped_tracks.json');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[+] Created directory: ${outputDir}`);
}
// ─── Title Parsing ────────────────────────────────────────────────────────────
/**
 * Attempt to parse a YouTube video title into a clean { title, answers } pair.
 * Rules (in order):
 *  1. Strip common noise: [HD], (Full Song), 「lyrics」, etc.
 *  2. Try to detect "Anime - Song - OP/ED N" patterns.
 *  3. Fall back to the cleaned title as-is.
 *
 * Returns:
 *  - title: display title in the format "Anime - Song - Opening N"
 *  - answers: array of accepted answers (at minimum 1)
 */
function parseYouTubeTitle(rawTitle, theme) {
    // --- Step 1: Strip noise ---
    let s = rawTitle
        .replace(/\[.*?\]/g, '') // Remove [HD], [AMV], etc.
        .replace(/【.*?】/g, '') // Japanese brackets
        .replace(/「.*?」/g, '') // Japanese quotes
        .replace(/\((?:full|clean|lyrics?|4k|hd|official|mv|amv|ncop|nced|version|ver\.?)[^)]*\)/gi, '')
        .replace(/\|\s*.*$/gi, '') // "| Lyrics" at end
        .replace(/ft\.?\s+[\w\s]+/gi, '') // "ft. Artist"
        .replace(/[\u2018-\u201F]/g, "'") // fancy quotes to normal
        .replace(/\s{2,}/g, ' ')
        .trim();
    // --- Step 2: Pattern matching ---
    // Common YouTube format: "Anime Name Opening/Ending N Song Name"
    // or "Song Name | Anime Name | Opening N"
    const opedPattern = /^(.+?)\s+(?:opening|ending|op|ed|ost)\s*(\d*)\s*[-–—]?\s*(.*)$/i;
    const pipePattern = /^(.+?)\s*[|\/]\s*(.+?)\s*[|\/]\s*(op|ed|opening|ending\s*\d*)$/i;
    const dashPattern = /^(.+?)\s*[-–—]\s*(.+?)(?:\s*[-–—]\s*(.+))?$/;
    let animeName = '';
    let songName = '';
    let opEdInfo = '';
    let m;
    if ((m = s.match(opedPattern))) {
        animeName = m[1].trim();
        const num = m[2] ? ` ${m[2]}` : '';
        opEdInfo = `Opening${num}`; // defaulting to Opening; tune if needed
        songName = m[3].trim();
    }
    else if ((m = s.match(pipePattern))) {
        songName = m[1].trim();
        animeName = m[2].trim();
        opEdInfo = m[3].trim();
    }
    else if ((m = s.match(dashPattern))) {
        animeName = m[1].trim();
        songName = m[2].trim();
        opEdInfo = m[3] ? m[3].trim() : '';
    }
    // Build clean title
    let cleanTitle = animeName
        ? [animeName, songName, opEdInfo].filter(Boolean).join(' - ')
        : s;
    // Build answer variants
    const firstAnswer = animeName && songName
        ? `${animeName} - ${songName}`
        : cleanTitle;
    const answers = [firstAnswer];
    // Add a shorter anime-only answer as secondary
    if (animeName && !answers.includes(animeName)) {
        answers.push(animeName);
    }
    return { title: cleanTitle, answers };
}
/**
 * Uses ffmpeg to detect when the initial silence ends and the actual music begins.
 */
function detectStartTime(audioPath) {
    try {
        console.log(`         ⏳ Detecting start time...`);
        // We look for silence > 0.4s at -40dB 
        const cmd = `ffmpeg -i "${audioPath}" -af silencedetect=noise=-40dB:d=0.4 -f null - 2>&1`;
        // run command, stdio: 'pipe' catches output so we can parse it
        const output = (0, child_process_1.execSync)(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        const match = output.match(/silence_end:\s*([\d.]+)/);
        if (match && match[1]) {
            const time = Math.floor(parseFloat(match[1]));
            return time > 0 ? time : 0;
        }
    }
    catch (e) {
        // execSync throws if the command exits with non-zero.
        // Some ffmpeg runs might produce stderr that throws but still have our data.
        const output = (e.stdout || '') + (e.stderr || '') + (e.message || '');
        const match = output.match(/silence_end:\s*([\d.]+)/);
        if (match && match[1]) {
            const time = Math.floor(parseFloat(match[1]));
            return time > 0 ? time : 0;
        }
        console.warn(`         ⚠ Start time detection failed or not applicable.`);
    }
    return 0; // Default if no initial silence found
}
// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🎵 BlindTest Scraper`);
    console.log(`   Playlist : ${PLAYLIST_URL}`);
    console.log(`   Thème    : ${THEME}`);
    console.log(`   Difficulté : ${DIFFICULTY}\n`);
    // Step 1: Fetch playlist metadata (no download)
    console.log('⏳ Fetching playlist metadata (this may take a minute)...');
    let info;
    try {
        info = await (0, youtube_dl_exec_1.default)(PLAYLIST_URL, {
            dumpSingleJson: true,
            flatPlaylist: true,
            noWarnings: true,
        });
    }
    catch (err) {
        console.error('❌ Failed to fetch playlist:', err.message);
        process.exit(1);
    }
    const entries = info.entries ?? [info];
    console.log(`✅ Found ${entries.length} tracks.\n`);
    const tracks = [];
    let downloaded = 0;
    let failed = 0;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const rawTitle = entry.title ?? entry.id ?? `Track ${i + 1}`;
        const videoUrl = entry.url ?? `https://www.youtube.com/watch?v=${entry.id}`;
        const { title, answers } = parseYouTubeTitle(rawTitle, THEME);
        // Sanitize filename
        const safeFileName = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0, 80);
        const audioPath = path.join(outputDir, `${safeFileName}.mp3`);
        const audioUrl = `/audio/${THEME}/${safeFileName}.mp3`;
        console.log(`[${i + 1}/${entries.length}] ${rawTitle}`);
        console.log(`         → title   : ${title}`);
        console.log(`         → answers : ${JSON.stringify(answers)}`);
        // Skip if already downloaded
        if (fs.existsSync(audioPath)) {
            console.log(`         ↩ Already exists, skipping download.`);
        }
        else {
            try {
                await (0, youtube_dl_exec_1.default)(videoUrl, {
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: 0,
                    output: audioPath,
                    noWarnings: true,
                });
                downloaded++;
                console.log(`         ✅ Downloaded.`);
            }
            catch (err) {
                console.warn(`         ⚠ Download failed: ${err.message}`);
                failed++;
                continue; // Skip this track from JSON if it couldn't be downloaded
            }
        }
        // Detect start time automatically
        const startTime = detectStartTime(audioPath);
        if (startTime > 0) {
            console.log(`         🎵 Starts at: ${startTime}s`);
        }
        tracks.push({
            title,
            answer: JSON.stringify(answers),
            theme: THEME,
            difficulty: DIFFICULTY,
            audio_url: audioUrl,
            start_time: startTime,
        });
    }
    // Write JSON output
    fs.writeFileSync(jsonOutput, JSON.stringify(tracks, null, 2), 'utf-8');
    console.log(`\n✅ Done! ${downloaded} downloaded, ${failed} failed.`);
    console.log(`📄 Review and edit: ${jsonOutput}`);
    console.log(`   Then run: npx ts-node src/seed.ts\n`);
}
main();
