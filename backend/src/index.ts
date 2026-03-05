import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

// Serve static audio files from the 'public/audio' folder
// Ensure __dirname is correctly pointing to 'src', so we go up one level to 'public'
app.use('/audio', express.static(path.join(__dirname, '../public/audio')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player {
    socketId: string;
    username: string;
    score: number;
    cooldownUntil?: number;
}

interface Question {
    text: string;
    answer: string;
    theme: string;
    difficulty: string;
    audioUrl: string;
}

interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>; // key = socketId
    phase: 'waiting' | 'playing' | 'finished';
    buzzerLockedBy: string | null; // username
    currentQuestionIndex: number;
    timerInterval: ReturnType<typeof setInterval> | null;
    resetTimeout: ReturnType<typeof setTimeout> | null;
    trackTimer: ReturnType<typeof setInterval> | null;
    trackRemaining: number;
}

// ─── Data ────────────────────────────────────────────────────────────────────
const MOCK_QUESTIONS: Question[] = [
    { text: "De quel anime provient tout cet ending ?", answer: "Oshi No Ko", theme: "Anime", difficulty: "Moyen", audioUrl: "/audio/Anime/OshiNoKo_Serenade_ending3.mp3" },
    { text: "Ce thème épique appartient à quel jeu vidéo ?", answer: "Skyrim", theme: "Jeux Vidéo", difficulty: "Facile", audioUrl: "/audio/JeuxVideo/Skyrim_Dovahkiin.mp3" },
    { text: "Ce célèbre mème du chat tourne sur quelle musique en fond ?", answer: "After Dark", theme: "Musique", difficulty: "Difficile", audioUrl: "/audio/Musique/OiiaoiiaCatXAfterDark.mp3" }
];

const rooms = new Map<string, Room>();
const ANSWER_DURATION = 15;
const POINTS_CORRECT = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCode(): string {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function roomPayload(room: Room) {
    const q = MOCK_QUESTIONS[room.currentQuestionIndex];
    return {
        code: room.code,
        hostUsername: room.players.get(room.hostSocketId)?.username ?? null,
        phase: room.phase,
        players: [...room.players.values()].map(p => ({ username: p.username, score: p.score })),
        buzzerLockedBy: room.buzzerLockedBy,
        currentQuestion: (room.phase === 'playing' && q) ? { text: q.text, theme: q.theme, difficulty: q.difficulty, audioUrl: q.audioUrl } : null,
    };
}

function clearRoomTimers(room: Room) {
    if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
    if (room.resetTimeout) { clearTimeout(room.resetTimeout); room.resetTimeout = null; }
}

function clearTrackTimer(room: Room) {
    if (room.trackTimer) { clearInterval(room.trackTimer); room.trackTimer = null; }
}

function startTrackTimer(room: Room) {
    clearTrackTimer(room);
    room.trackTimer = setInterval(() => {
        room.trackRemaining--;
        // Emit the remaining time here so we have a global progress bar
        io.to(room.code).emit('track_timer_tick', { remaining: room.trackRemaining });
        if (room.trackRemaining <= 0) {
            clearTrackTimer(room);
            const question = MOCK_QUESTIONS[room.currentQuestionIndex];
            if (question) {
                // Time up! Broadcast the answer to EVERYONE
                io.to(room.code).emit('round_won', {
                    user: 'Personne',
                    correctAnswer: question.answer
                });
                console.log(`[GAME] Time up in ${room.code}. Answer was ${question.answer}`);

                setTimeout(() => {
                    goToNextQuestion(room);
                }, 5000);
            }
        }
    }, 1000);
}

const goToNextQuestion = (room: Room) => {
    room.currentQuestionIndex++;
    clearTrackTimer(room);
    clearRoomTimers(room);
    room.buzzerLockedBy = null;

    if (room.currentQuestionIndex >= MOCK_QUESTIONS.length) {
        room.phase = 'finished'; // Go to leaderboard
        io.to(room.code).emit('room_state', roomPayload(room));
        // Reset the win/timeout overlay in frontend
        io.to(room.code).emit('buzzer_reset');
        console.log(`[GAME] All questions played in room ${room.code}. Showing leaderboard.`);
    } else {
        room.trackRemaining = 30; // reset the 30s timer
        startTrackTimer(room);
        io.to(room.code).emit('room_state', roomPayload(room));
        io.to(room.code).emit('buzzer_reset');
        console.log(`[GAME] Next question in room ${room.code}. Index: ${room.currentQuestionIndex}`);
    }
};

function findRoomBySocket(socketId: string): Room | null {
    for (const room of rooms.values()) {
        if (room.players.has(socketId)) return room;
    }
    return null;
}

function leaveRoom(socket: Socket) {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    room.players.delete(socket.id);
    socket.leave(room.code);

    if (room.players.size === 0) {
        clearRoomTimers(room);
        clearTrackTimer(room);
        rooms.delete(room.code);
        console.log(`[ROOM] Deleted empty room ${room.code}`);
    } else {
        // Transfer host if needed
        if (room.hostSocketId === socket.id) {
            const nextHostId = room.players.keys().next().value;
            if (nextHostId) {
                room.hostSocketId = nextHostId;
                console.log(`[ROOM] Host ${player?.username} left ${room.code}. New host: ${room.players.get(room.hostSocketId)?.username}`);
            }
        }
        io.to(room.code).emit('room_state', roomPayload(room));
        console.log(`[-] ${player?.username} left room ${room.code}`);
    }
}

// ─── Socket ───────────────────────────────────────────────────────────────────
io.on('connection', (socket: Socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    // ── CREATE ROOM ────────────────────────────────────────────────────────────
    socket.on('create_room', ({ username }: { username: string }) => {
        leaveRoom(socket); // Ensure clean slate
        let code = generateCode();
        while (rooms.has(code)) code = generateCode();

        const room: Room = {
            code,
            hostSocketId: socket.id,
            players: new Map([[socket.id, { socketId: socket.id, username, score: 0 }]]),
            phase: 'waiting',
            buzzerLockedBy: null,
            currentQuestionIndex: 0,
            timerInterval: null,
            resetTimeout: null,
            trackTimer: null,
            trackRemaining: 30,
        };
        rooms.set(code, room);
        socket.join(code);
        socket.emit('room_joined', roomPayload(room));
        console.log(`[ROOM] Created: ${code} by ${username}`);
    });

    // ── JOIN ROOM ──────────────────────────────────────────────────────────────
    socket.on('join_room', ({ code, username }: { code: string; username: string }) => {
        leaveRoom(socket); // Ensure clean slate
        const room = rooms.get(code.toUpperCase());
        if (!room) { socket.emit('room_error', { message: 'Salon introuvable.' }); return; }
        if (room.phase === 'playing') { socket.emit('room_error', { message: 'La partie a déjà commencé.' }); return; }

        // Replace if same username reconnects (edge case)
        room.players.set(socket.id, { socketId: socket.id, username, score: 0 });
        socket.join(code);
        io.to(code).emit('room_state', roomPayload(room));
        socket.emit('room_joined', roomPayload(room));
        console.log(`[ROOM] ${username} joined ${code}`);
    });

    // ── LEAVE ROOM ─────────────────────────────────────────────────────────────
    socket.on('leave_room', () => {
        leaveRoom(socket);
    });

    // ── START GAME ─────────────────────────────────────────────────────────────
    socket.on('start_game', () => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase === 'playing') return;

        room.phase = 'playing';
        room.currentQuestionIndex = 0;
        room.trackRemaining = 30;
        startTrackTimer(room);
        io.to(room.code).emit('game_started', roomPayload(room));
        console.log(`[GAME] Started in room ${room.code}. Playing first question.`);
    });

    // ── PLAY AGAIN ─────────────────────────────────────────────────────────────
    socket.on('play_again', () => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== 'finished') return;

        room.phase = 'waiting';
        room.currentQuestionIndex = 0;
        room.players.forEach(p => p.score = 0); // Reset scores
        io.to(room.code).emit('room_state', roomPayload(room));
        console.log(`[ROOM] Game reset in room ${room.code}. Back to lobby.`);
    });

    // ── NEXT QUESTION ──────────────────────────────────────────────────────────
    // Removing the explicit next_question handler to prevent the host from skipping
    // (Commented out just in case we need it later for admin powers)
    /*
    socket.on('next_question', () => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        goToNextQuestion(room);
    });
    */

    // ── BUZZ ───────────────────────────────────────────────────────────────────
    socket.on('buzz', ({ username }: { username: string }) => {
        const room = findRoomBySocket(socket.id);
        const player = room?.players.get(socket.id);
        if (!room || room.phase !== 'playing' || room.buzzerLockedBy || !player) return;

        // Check for penalty cooldown (e.g. after a wrong answer)
        if (player.cooldownUntil && player.cooldownUntil > Date.now()) {
            socket.emit('room_error', { message: "Attends 1s avant de rebuzzer !" });
            return;
        }

        // Pause the global track timer while someone answers
        clearTrackTimer(room);

        room.buzzerLockedBy = username;
        io.to(room.code).emit('buzzer_locked', { user: username });

        let remaining = ANSWER_DURATION;
        io.to(room.code).emit('timer_tick', { remaining });

        room.timerInterval = setInterval(() => {
            remaining--;
            io.to(room.code).emit('timer_tick', { remaining });
            if (remaining <= 0) clearRoomTimers(room);
        }, 1000);

        room.resetTimeout = setTimeout(() => {
            clearRoomTimers(room);
            room.buzzerLockedBy = null;
            // Penalty for timing out
            player.cooldownUntil = Date.now() + 1000;
            io.to(room.code).emit('buzzer_reset');
            // Resume the track timer
            startTrackTimer(room);
            console.log(`[BUZZ] Buzzer reset in ${room.code} due to timeout. Track timer resumed.`);
        }, ANSWER_DURATION * 1000);

        console.log(`[BUZZ] ${username} buzzed in ${room.code}`);
    });

    // ── TYPING ANSWER ──────────────────────────────────────────────────────────
    socket.on('typing_answer', ({ answer }: { answer: string }) => {
        const room = findRoomBySocket(socket.id);
        const player = room?.players.get(socket.id);
        if (!room || room.buzzerLockedBy !== player?.username) return;

        socket.to(room.code).emit('opponent_typing', { answer });
    });

    // ── SUBMIT ANSWER ──────────────────────────────────────────────────────────
    socket.on('submit_answer', ({ username, answer }: { username: string; answer: string }) => {
        const room = findRoomBySocket(socket.id);
        const player = room?.players.get(socket.id);
        if (!room || !player || room.buzzerLockedBy !== username) return;

        const question = MOCK_QUESTIONS[room.currentQuestionIndex];
        const submitted = answer.trim().toLowerCase();
        const target = question.answer.toLowerCase();

        // Simple fuzzy match: exact or contains
        const correct = submitted === target || target.includes(submitted) || submitted.includes(target);

        if (correct) {
            player.score += POINTS_CORRECT;
        }

        io.to(room.code).emit('answer_result', {
            user: username,
            answer,
            correct,
            scores: [...room.players.values()].map(p => ({ username: p.username, score: p.score })),
        });

        if (correct) {
            clearRoomTimers(room);
            // Broadcast the correct answer to EVERYONE 
            io.to(room.code).emit('round_won', {
                user: username,
                correctAnswer: question.answer
            });

            setTimeout(() => {
                room.buzzerLockedBy = null;
                io.to(room.code).emit('buzzer_reset');
                goToNextQuestion(room);
            }, 5000); // Wait 5 seconds to let people see the answer, then auto-advance
            console.log(`[ANSWER] ${username}: "${answer}" — CORRECT ✓ in ${room.code}`);
        } else {
            clearRoomTimers(room);
            setTimeout(() => {
                room.buzzerLockedBy = null;
                // Apply 1s cooldown on wrong answer starting NOW (when the buzzer is released)
                player.cooldownUntil = Date.now() + 1000;
                io.to(room.code).emit('buzzer_reset');
                // Resume track timer since they were wrong
                startTrackTimer(room);
            }, 2000);
            console.log(`[ANSWER] ${username}: "${answer}" — WRONG ✗ in ${room.code}`);
        }
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        leaveRoom(socket);
    });
});

const PORT = 8000;
server.listen(PORT, () => console.log(`BlindTest Backend on port ${PORT}`));
