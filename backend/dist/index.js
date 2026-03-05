"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const database_1 = require("./database");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Serve static audio files from the 'public/audio' folder
app.use('/audio', express_1.default.static(path_1.default.join(__dirname, '../public/audio')));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
// ─── Data ────────────────────────────────────────────────────────────────────
const rooms = new Map();
const ANSWER_DURATION = 15;
const POINTS_CORRECT = 100;
// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}
function normalizeString(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // Remove punctuation
        .trim()
        .replace(/\s+/g, " "); // Remove extra spaces
}
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
/** Parse a track's 'answer' field: supports both plain strings and JSON arrays of accepted answers. */
function getAnswers(rawAnswer) {
    try {
        const parsed = JSON.parse(rawAnswer);
        if (Array.isArray(parsed))
            return parsed.filter(a => typeof a === 'string');
    }
    catch (_) { /* not JSON, treat as plain string */ }
    return [rawAnswer];
}
function isAnswerValid(input, expected, isFullTitle = false) {
    const normalizedInput = normalizeString(input);
    const normalizedExpected = normalizeString(expected);
    if (normalizedInput === normalizedExpected)
        return true;
    const noSpaceInput = normalizedInput.replace(/\s/g, "");
    const noSpaceExpected = normalizedExpected.replace(/\s/g, "");
    // Direct match without spaces
    if (noSpaceInput === noSpaceExpected)
        return true;
    // Reject extremely short guesses for partial matching
    if (normalizedInput.length < 4)
        return false;
    // List of "metadata" words that should never validate a partial match
    // Especially when checking against the full title which contains "Opening", "Ending", etc.
    const genericWords = ["opening", "ending", "theme", "ost", "version", "full", "remix", "music", "audio", "track", "op", "ed", "original", "soundtrack"];
    // If the input is just a generic word, it must be an exact match (already checked above)
    if (genericWords.includes(normalizedInput))
        return false;
    // Reject inputs where ALL words are either generic metadata words or plain numbers
    // (e.g. "Ending 3", "Op 2", "Opening 1" — these never uniquely identify a song)
    const inputTokens = normalizedInput.split(/\s+/).filter(w => w.length > 0);
    const allGenericOrNumeric = inputTokens.every(w => genericWords.includes(w) || /^\d+$/.test(w));
    if (allGenericOrNumeric)
        return false;
    // For the full title (which contains song names and extra info), we are VERY strict with partials
    if (isFullTitle) {
        // 1. Substring match: the input must be a substring of the title (e.g. "After Dark" in "Oiiaoiia Cat X After Dark")
        if (normalizedInput.length >= 8 && normalizedExpected.includes(normalizedInput))
            return true;
        // 2. Word-subset match: every word in the input must exist (exact or prefix 3+ chars) in the title words.
        //    Handles mash-up titles like "Oiia After Dark" matching "Oiiaoiia Cat X After Dark".
        const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 0);
        const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 0);
        if (inputWords.length >= 2) {
            const allWordsMatch = inputWords.every(iw => expectedWords.some(ew => ew === iw || // exact
                (iw.length >= 3 && ew.startsWith(iw)) || // prefix
                (iw.length >= 3 && levenshtein(iw, ew.substring(0, iw.length + 1)) <= 1) // fuzzy prefix (1 typo, handles "oia" → "oiia...")
            ));
            if (allWordsMatch)
                return true;
        }
        return false;
    }
    // For the "Work Name" (franchise/anime/game), we are more lenient
    // 1. Prefix match (Naruto -> Naruto Shippuden)
    if (normalizedExpected.startsWith(normalizedInput))
        return true;
    // 2. Acronym match (snk -> shingeki no kyojin)
    const words = normalizedExpected.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
        const acronym = words.map(w => w[0]).join("");
        if (normalizedInput === acronym)
            return true;
    }
    // 3. Contains match, but require it to be significant (e.g. 50% of the target or 6+ chars)
    if (normalizedExpected.includes(normalizedInput)) {
        if (normalizedInput.length >= 6 || normalizedInput.length >= normalizedExpected.length * 0.5) {
            return true;
        }
    }
    // Allow slight typos: 1 typo per 5 characters, max 3
    const allowedTypos = Math.min(3, Math.floor(normalizedExpected.length / 5));
    const distance = levenshtein(normalizedInput, normalizedExpected);
    return distance <= allowedTypos;
}
const roomPayload = (room) => {
    const q = room.questions[room.currentQuestionIndex];
    return {
        code: room.code,
        hostPlayerId: room.hostPlayerId,
        phase: room.phase,
        players: [...room.players.values()].map(p => ({
            playerId: p.playerId,
            username: p.username,
            score: p.score,
            avatarUrl: p.avatarUrl
        })),
        buzzerLockedBy: room.buzzerLockedBy,
        currentQuestion: (room.phase === 'playing' && q) ? { text: q.title, theme: q.theme, difficulty: q.difficulty, audioUrl: q.audio_url, startTime: q.start_time ?? 0 } : null,
        settings: room.settings,
        availableThemes: ['Tous', ...(0, database_1.getThemes)()],
    };
};
function clearRoomTimers(room) {
    if (room.roundTimer) {
        clearInterval(room.roundTimer);
        room.roundTimer = undefined;
    }
    if (room.resetTimeout) {
        clearTimeout(room.resetTimeout);
        room.resetTimeout = undefined;
    }
}
function clearTrackTimer(room) {
    if (room.trackTimer) {
        clearInterval(room.trackTimer);
        room.trackTimer = undefined;
    }
}
function startTrackTimer(room) {
    clearTrackTimer(room);
    room.trackTimer = setInterval(() => {
        room.trackRemaining--;
        io.to(room.code).emit('track_timer_tick', { remaining: room.trackRemaining });
        if (room.trackRemaining <= 0) {
            clearTrackTimer(room);
            const question = room.questions[room.currentQuestionIndex];
            if (question) {
                room.buzzerLockedBy = null;
                io.to(room.code).emit('round_won', { user: 'Personne', correctAnswer: question.title });
                setTimeout(() => {
                    goToNextQuestion(room);
                }, 4000);
            }
        }
    }, 1000);
}
const goToNextQuestion = (room) => {
    room.currentQuestionIndex++;
    clearTrackTimer(room);
    clearRoomTimers(room);
    room.buzzerLockedBy = null;
    if (room.currentQuestionIndex >= room.questions.length) {
        room.phase = 'finished'; // Go to leaderboard
        io.to(room.code).emit('room_state', roomPayload(room));
        io.to(room.code).emit('buzzer_reset');
        console.log(`[GAME] All questions played in room ${room.code}. Showing leaderboard.`);
    }
    else {
        room.trackRemaining = room.settings.duration; // reset the timer based on settings
        startTrackTimer(room);
        io.to(room.code).emit('room_state', roomPayload(room));
        io.to(room.code).emit('buzzer_reset');
        console.log(`[GAME] Next question in room ${room.code}. Index: ${room.currentQuestionIndex}`);
    }
};
function findRoomBySocket(socketId) {
    for (const room of rooms.values()) {
        for (const p of room.players.values()) {
            if (p.socketId === socketId)
                return room;
        }
    }
    return null;
}
function getPlayerBySocket(socketId, room) {
    for (const p of room.players.values()) {
        if (p.socketId === socketId)
            return p;
    }
    return null;
}
function leaveRoom(socket) {
    const room = findRoomBySocket(socket.id);
    if (!room)
        return;
    const player = getPlayerBySocket(socket.id, room);
    if (!player)
        return;
    socket.leave(room.code);
    if (room.phase === 'waiting') {
        room.players.delete(player.playerId);
        if (room.players.size === 0) {
            clearRoomTimers(room);
            clearTrackTimer(room);
            rooms.delete(room.code);
            console.log(`[ROOM] Deleted empty room ${room.code}`);
        }
        else {
            if (room.hostPlayerId === player.playerId) {
                const nextHostId = room.players.keys().next().value;
                if (nextHostId) {
                    room.hostPlayerId = nextHostId;
                    console.log(`[ROOM] Host ${player.username} left. New host: ${room.players.get(room.hostPlayerId)?.username}`);
                }
            }
            io.to(room.code).emit('room_state', roomPayload(room));
            console.log(`[-] ${player.username} left room ${room.code}`);
        }
    }
    else {
        // Game is playing, mark player as disconnected but keep them in the room
        player.socketId = '';
        console.log(`[-] ${player.username} disconnected from room ${room.code} (game in progress)`);
        io.to(room.code).emit('room_state', roomPayload(room));
        // Clean up room if everyone disconnected
        let allOffline = true;
        for (const p of room.players.values()) {
            if (p.socketId)
                allOffline = false;
        }
        if (allOffline) {
            clearRoomTimers(room);
            clearTrackTimer(room);
            rooms.delete(room.code);
            console.log(`[ROOM] Deleted abandoned room ${room.code}`);
        }
    }
}
// ─── Socket ───────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);
    socket.on('create_room', ({ playerId, username, avatarSeed }) => {
        leaveRoom(socket);
        let code = generateCode();
        while (rooms.has(code))
            code = generateCode();
        const room = {
            code,
            hostPlayerId: playerId,
            players: new Map([[playerId, {
                        socketId: socket.id,
                        playerId,
                        username,
                        avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatarSeed || username}`,
                        score: 0
                    }]]),
            phase: 'waiting',
            questions: [],
            buzzerLockedBy: null,
            currentQuestionIndex: 0,
            trackRemaining: 30,
            settings: {
                theme: 'Tous',
                questionCount: 5,
                duration: 30
            }
        };
        rooms.set(code, room);
        socket.join(code);
        socket.emit('room_joined', roomPayload(room));
        console.log(`[ROOM] Created: ${code} by ${username}`);
    });
    socket.on('join_room', ({ code, playerId, username, avatarSeed }) => {
        leaveRoom(socket);
        const room = rooms.get(code.toUpperCase());
        if (!room) {
            socket.emit('room_error', { message: 'Salon introuvable.' });
            return;
        }
        const existingPlayer = room.players.get(playerId);
        if (room.phase === 'playing') {
            if (!existingPlayer) {
                socket.emit('room_error', { message: 'La partie a déjà commencé.' });
                return;
            }
            existingPlayer.socketId = socket.id;
        }
        else {
            if (existingPlayer) {
                existingPlayer.socketId = socket.id;
                existingPlayer.username = username; // Update username if they changed it
                existingPlayer.avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatarSeed || username}`;
            }
            else {
                room.players.set(playerId, {
                    socketId: socket.id,
                    playerId,
                    username,
                    avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatarSeed || username}`,
                    score: 0
                });
            }
        }
        socket.join(code);
        io.to(code).emit('room_state', roomPayload(room));
        socket.emit('room_joined', roomPayload(room));
        if (room.phase === 'playing') {
            socket.emit('game_started', roomPayload(room));
            socket.emit('track_timer_tick', { remaining: room.trackRemaining });
            if (room.buzzerLockedBy) {
                socket.emit('buzzer_locked', { user: room.buzzerLockedBy });
            }
        }
        console.log(`[+] ${username} joined ${code}`);
    });
    socket.on('leave_room', () => {
        leaveRoom(socket);
    });
    socket.on('start_game', () => {
        const room = findRoomBySocket(socket.id);
        const player = room ? getPlayerBySocket(socket.id, room) : null;
        if (room && player && room.hostPlayerId === player.playerId && room.phase === 'waiting') {
            room.questions = (0, database_1.getTracks)(room.settings.questionCount, room.settings.theme);
            room.phase = 'playing';
            room.currentQuestionIndex = 0;
            room.trackRemaining = room.settings.duration;
            startTrackTimer(room);
            io.to(room.code).emit('game_started', roomPayload(room));
            console.log(`[GAME] Room ${room.code} started with ${room.questions.length} tracks (Theme: ${room.settings.theme}).`);
        }
    });
    socket.on('play_again', () => {
        const room = findRoomBySocket(socket.id);
        const player = room ? getPlayerBySocket(socket.id, room) : null;
        if (room && player && room.hostPlayerId === player.playerId && room.phase === 'finished') {
            room.players.forEach(p => p.score = 0);
            room.phase = 'waiting';
            room.questions = [];
            room.currentQuestionIndex = 0;
            room.buzzerLockedBy = null;
            io.to(room.code).emit('room_state', roomPayload(room));
            console.log(`[GAME] Room ${room.code} returned to lobby.`);
        }
    });
    socket.on('update_settings', (settings) => {
        const room = findRoomBySocket(socket.id);
        const player = room ? getPlayerBySocket(socket.id, room) : null;
        if (room && player && room.hostPlayerId === player.playerId && room.phase === 'waiting') {
            room.settings = settings;
            io.to(room.code).emit('room_state', roomPayload(room));
            console.log(`[SETTINGS] Room ${room.code} updated:`, settings);
        }
    });
    socket.on('buzz', ({ playerId, username }) => {
        const room = findRoomBySocket(socket.id);
        const player = room ? getPlayerBySocket(socket.id, room) : null;
        if (!room || room.phase !== 'playing' || room.buzzerLockedBy || !player)
            return;
        const q = room.questions[room.currentQuestionIndex];
        if (!q)
            return;
        if (player.cooldownUntil && player.cooldownUntil > Date.now()) {
            socket.emit('room_error', { message: "Attends 1s avant de rebuzzer !" });
            return;
        }
        clearTrackTimer(room);
        room.buzzerLockedBy = playerId;
        io.to(room.code).emit('buzzer_locked', { user: username, playerId });
        let remaining = ANSWER_DURATION;
        io.to(room.code).emit('timer_tick', { remaining });
        room.roundTimer = setInterval(() => {
            remaining--;
            io.to(room.code).emit('timer_tick', { remaining });
            if (remaining <= 0)
                clearRoomTimers(room);
        }, 1000);
        room.resetTimeout = setTimeout(() => {
            clearRoomTimers(room);
            room.buzzerLockedBy = null;
            player.cooldownUntil = Date.now() + 1000;
            io.to(room.code).emit('buzzer_reset');
            startTrackTimer(room);
        }, ANSWER_DURATION * 1000);
        console.log(`[BUZZ] ${username} buzzed in ${room.code}`);
    });
    socket.on('typing_answer', ({ answer }) => {
        const room = findRoomBySocket(socket.id);
        const player = room ? getPlayerBySocket(socket.id, room) : null;
        if (!room || room.buzzerLockedBy !== player?.playerId)
            return;
        socket.to(room.code).emit('opponent_typing', { answer });
    });
    socket.on('submit_answer', ({ playerId, username, answer }) => {
        const room = findRoomBySocket(socket.id);
        const player = room ? getPlayerBySocket(socket.id, room) : null;
        if (!room || !player || room.buzzerLockedBy !== playerId)
            return;
        const q = room.questions[room.currentQuestionIndex];
        if (!q)
            return;
        // Check against all accepted answer variants (supports JSON array of language variants)
        const answerVariants = getAnswers(q.answer);
        const correct = answerVariants.some(v => isAnswerValid(answer, v)) || isAnswerValid(answer, q.title, true);
        if (correct)
            player.score += POINTS_CORRECT;
        io.to(room.code).emit('answer_result', {
            user: username,
            playerId,
            answer,
            correct,
            scores: [...room.players.values()].map(p => ({
                playerId: p.playerId,
                username: p.username,
                score: p.score,
                avatarUrl: p.avatarUrl
            })),
        });
        if (correct) {
            clearRoomTimers(room);
            io.to(room.code).emit('round_won', { user: username, correctAnswer: q.title });
            setTimeout(() => {
                room.buzzerLockedBy = null;
                io.to(room.code).emit('buzzer_reset');
                goToNextQuestion(room);
            }, 5000);
        }
        else {
            clearRoomTimers(room);
            setTimeout(() => {
                room.buzzerLockedBy = null;
                player.cooldownUntil = Date.now() + 1000;
                io.to(room.code).emit('buzzer_reset');
                startTrackTimer(room);
            }, 2000);
        }
    });
    socket.on('disconnect', () => {
        leaveRoom(socket);
    });
});
const PORT = 8000;
server.listen(PORT, () => console.log(`BlindTest Backend on port ${PORT}`));
