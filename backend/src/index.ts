import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player {
    socketId: string;
    username: string;
    score: number;
}

interface Question {
    text: string;
    answer: string;
    theme: string;
    difficulty: string;
}

interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>; // key = socketId
    phase: 'waiting' | 'playing';
    buzzerLockedBy: string | null; // username
    currentQuestionIndex: number;
    timerInterval: ReturnType<typeof setInterval> | null;
    resetTimeout: ReturnType<typeof setTimeout> | null;
}

// ─── Data ────────────────────────────────────────────────────────────────────
const MOCK_QUESTIONS: Question[] = [
    { text: "Qui est le protagoniste de One Piece ?", answer: "Luffy", theme: "Anime", difficulty: "Facile" },
    { text: "Nom de l'épée de Link ?", answer: "Master Sword", theme: "Jeux Vidéo", difficulty: "Moyen" },
    { text: "Nom de famille de Naruto ?", answer: "Uzumaki", theme: "Anime", difficulty: "Facile" },
    { text: "Cité sous-marine dans Bioshock ?", answer: "Rapture", theme: "Jeux Vidéo", difficulty: "Difficile" },
    { text: "Nom du plombier rouge ?", answer: "Mario", theme: "Jeux Vidéo", difficulty: "Facile" },
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
        currentQuestion: q ? { text: q.text, theme: q.theme, difficulty: q.difficulty } : null,
    };
}

function clearRoomTimers(room: Room) {
    if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
    if (room.resetTimeout) { clearTimeout(room.resetTimeout); room.resetTimeout = null; }
}

function findRoomBySocket(socketId: string): Room | null {
    for (const room of rooms.values()) {
        if (room.players.has(socketId)) return room;
    }
    return null;
}

// ─── Socket ───────────────────────────────────────────────────────────────────
io.on('connection', (socket: Socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    // ── CREATE ROOM ────────────────────────────────────────────────────────────
    socket.on('create_room', ({ username }: { username: string }) => {
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
        };
        rooms.set(code, room);
        socket.join(code);
        socket.emit('room_joined', roomPayload(room));
        console.log(`[ROOM] Created: ${code} by ${username}`);
    });

    // ── JOIN ROOM ──────────────────────────────────────────────────────────────
    socket.on('join_room', ({ code, username }: { code: string; username: string }) => {
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

    // ── START GAME ─────────────────────────────────────────────────────────────
    socket.on('start_game', () => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase === 'playing') return;

        room.phase = 'playing';
        room.currentQuestionIndex = 0;
        io.to(room.code).emit('game_started', roomPayload(room));
        console.log(`[GAME] Started in room ${room.code}`);
    });

    // ── NEXT QUESTION ──────────────────────────────────────────────────────────
    socket.on('next_question', () => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;

        room.currentQuestionIndex++;
        if (room.currentQuestionIndex >= MOCK_QUESTIONS.length) {
            room.phase = 'waiting'; // End game back to lobby for now
            io.to(room.code).emit('room_state', roomPayload(room));
            console.log(`[GAME] All questions played in room ${room.code}. Returning to waiting phase.`);
        } else {
            room.buzzerLockedBy = null;
            clearRoomTimers(room);
            io.to(room.code).emit('room_state', roomPayload(room));
            io.to(room.code).emit('buzzer_reset');
            console.log(`[GAME] Next question in room ${room.code}. Index: ${room.currentQuestionIndex}`);
        }
    });

    // ── BUZZ ───────────────────────────────────────────────────────────────────
    socket.on('buzz', ({ username }: { username: string }) => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.phase !== 'playing' || room.buzzerLockedBy) return;

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
            io.to(room.code).emit('buzzer_reset');
            console.log(`[BUZZ] Buzzer reset in ${room.code} due to timeout.`);
        }, ANSWER_DURATION * 1000);

        console.log(`[BUZZ] ${username} buzzed in ${room.code}`);
    });

    // ── SUBMIT ANSWER ──────────────────────────────────────────────────────────
    socket.on('submit_answer', ({ username, answer }: { username: string; answer: string }) => {
        const room = findRoomBySocket(socket.id);
        if (!room || room.buzzerLockedBy !== username) return;

        const question = MOCK_QUESTIONS[room.currentQuestionIndex];
        const submitted = answer.trim().toLowerCase();
        const target = question.answer.toLowerCase();

        // Simple fuzzy match: exact or contains
        const correct = submitted === target || target.includes(submitted) || submitted.includes(target);

        if (correct) {
            const player = room.players.get(socket.id);
            if (player) player.score += POINTS_CORRECT;
        }

        io.to(room.code).emit('answer_result', {
            user: username,
            answer,
            correct,
            scores: [...room.players.values()].map(p => ({ username: p.username, score: p.score })),
        });

        if (correct) {
            clearRoomTimers(room);
            setTimeout(() => {
                room.buzzerLockedBy = null;
                io.to(room.code).emit('buzzer_reset');
                // Automatically go to next question? Or wait for host?
                // Let's wait for host to click "Next" to avoid rushing
            }, 2000);
            console.log(`[ANSWER] ${username}: "${answer}" — CORRECT ✓ in ${room.code}`);
        } else {
            clearRoomTimers(room);
            setTimeout(() => {
                room.buzzerLockedBy = null;
                io.to(room.code).emit('buzzer_reset');
            }, 2000);
            console.log(`[ANSWER] ${username}: "${answer}" — WRONG ✗ in ${room.code}`);
        }
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const room = findRoomBySocket(socket.id);
        if (!room) return;

        const player = room.players.get(socket.id);
        room.players.delete(socket.id);

        if (room.players.size === 0) {
            clearRoomTimers(room);
            rooms.delete(room.code);
            console.log(`[ROOM] Deleted empty room ${room.code}`);
        } else {
            // Transfer host if needed
            if (room.hostSocketId === socket.id) {
                room.hostSocketId = room.players.keys().next().value!;
                console.log(`[ROOM] Host ${player?.username} left ${room.code}. New host: ${room.players.get(room.hostSocketId)?.username}`);
            }
            io.to(room.code).emit('room_state', roomPayload(room));
            console.log(`[-] ${player?.username} left room ${room.code}`);
        }
    });
});

const PORT = 8000;
server.listen(PORT, () => console.log(`BlindTest Backend on port ${PORT}`));
