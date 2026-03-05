import { ref, computed, watch } from 'vue';
import { io, Socket } from 'socket.io-client';

export interface PlayerScore { username: string; score: number; }
export interface RoomState {
    code: string;
    hostUsername: string | null;
    phase: 'waiting' | 'playing' | 'finished';
    players: PlayerScore[];
    buzzerLockedBy: string | null;
    currentQuestion: { text: string; theme: string; difficulty: string; audioUrl?: string } | null;
}

// Global singletons so state persists across route changes
const socket = ref<Socket | null>(null);
const isConnected = ref(false);
const username = ref('');
const room = ref<RoomState | null>(null);
const roomError = ref('');

const isHost = computed(() => room.value?.hostUsername === username.value);
const isLocked = ref(false);
const lockedBy = ref<string | null>(null);
const answer = ref('');
const answerResult = ref<{ correct: boolean } | null>(null);
const opponentTypingAnswer = ref('');
const timerRemaining = ref(0);
const trackRemaining = ref(30);
const scores = ref<PlayerScore[]>([]);
const roundWinner = ref<{ user: string; correctAnswer: string } | null>(null);

// Global Audio Player
const audioPlayer = new Audio();
audioPlayer.volume = 0.5;

export function useGame() {
    const initSocket = () => {
        if (!socket.value) {
            socket.value = io('http://localhost:8000');

            socket.value.on('connect', () => { isConnected.value = true; });
            socket.value.on('disconnect', () => { isConnected.value = false; });

            socket.value.on('room_joined', (state: RoomState) => {
                room.value = state;
                scores.value = state.players;
                roomError.value = '';
            });

            socket.value.on('room_state', (state: RoomState) => {
                room.value = state;
                scores.value = state.players;
            });

            socket.value.on('room_error', ({ message }: { message: string }) => {
                roomError.value = message;
            });

            socket.value.on('game_started', (state: RoomState) => {
                room.value = state;
                scores.value = state.players;
                isLocked.value = false;
                lockedBy.value = null;
                answer.value = '';
                answerResult.value = null;
                timerRemaining.value = 0;
                trackRemaining.value = 30;
                roundWinner.value = null;
                opponentTypingAnswer.value = '';
            });

            socket.value.on('buzzer_locked', (d: { user: string }) => {
                isLocked.value = true;
                lockedBy.value = d.user;
                answer.value = '';
                answerResult.value = null;
            });

            socket.value.on('timer_tick', (d: { remaining: number }) => {
                timerRemaining.value = d.remaining;
            });

            socket.value.on('track_timer_tick', (d: { remaining: number }) => {
                trackRemaining.value = d.remaining;
            });

            socket.value.on('opponent_typing', (d: { answer: string }) => {
                opponentTypingAnswer.value = d.answer;
            });

            socket.value.on('buzzer_reset', () => {
                isLocked.value = false;
                lockedBy.value = null;
                answer.value = '';
                timerRemaining.value = 0;
                answerResult.value = null;
                roundWinner.value = null;
                opponentTypingAnswer.value = '';
            });

            socket.value.on('answer_result', (d: { user: string; correct: boolean; scores: PlayerScore[] }) => {
                if (d.user === username.value) answerResult.value = { correct: d.correct };
                scores.value = d.scores;
            });

            socket.value.on('round_won', (d: { user: string; correctAnswer: string }) => {
                roundWinner.value = d;
            });
        }
    };

    const leaveRoom = () => {
        if (socket.value) {
            socket.value.emit('leave_room');
            room.value = null;
        }
    };

    // Watchers to manage audio playback automatically based on game state

    // 1. Play new track when the current question changes
    watch(() => room.value?.currentQuestion?.audioUrl, (newUrl, oldUrl) => {
        console.log("[AUDIO] Watcher triggered! newUrl:", newUrl, "oldUrl:", oldUrl);
        if (newUrl && newUrl !== oldUrl) {
            console.log("[AUDIO] Attempting to play new audio:", newUrl);
            // Stop previous audio if any
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            // Set new source and play
            audioPlayer.src = 'http://localhost:8000' + newUrl;
            audioPlayer.play().then(() => {
                console.log("[AUDIO] Playback successful.");
            }).catch(e => {
                console.error("[AUDIO] Playback blocked:", e);
            });
        } else if (!newUrl) {
            console.log("[AUDIO] No newUrl, pausing audio.");
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }
    });

    // 2. Pause audio when someone buzzes, resume if buzzer restarts
    watch(isLocked, (locked) => {
        if (locked) {
            audioPlayer.pause();
        } else if (room.value?.phase === 'playing' && room.value?.currentQuestion?.audioUrl) {
            // Only resume if still playing
            audioPlayer.play().catch(e => console.error("Audio playback blocked:", e));
        }
    });

    return {
        socket,
        isConnected,
        username,
        room,
        roomError,
        isHost,
        isLocked,
        lockedBy,
        answer,
        answerResult,
        timerRemaining,
        trackRemaining,
        scores,
        roundWinner,
        opponentTypingAnswer,
        initSocket,
        leaveRoom
    };
}
