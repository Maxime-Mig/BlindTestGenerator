import { ref, computed } from 'vue';
import { io, Socket } from 'socket.io-client';

export interface PlayerScore { username: string; score: number; }
export interface RoomState {
    code: string;
    hostUsername: string | null;
    phase: 'waiting' | 'playing';
    players: PlayerScore[];
    buzzerLockedBy: string | null;
    currentQuestion: { text: string; theme: string; difficulty: string } | null;
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
const timerRemaining = ref(0);
const scores = ref<PlayerScore[]>([]);

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

            socket.value.on('buzzer_reset', () => {
                isLocked.value = false;
                lockedBy.value = null;
                answer.value = '';
                timerRemaining.value = 0;
                answerResult.value = null;
            });

            socket.value.on('answer_result', (d: { user: string; correct: boolean; scores: PlayerScore[] }) => {
                if (d.user === username.value) answerResult.value = { correct: d.correct };
                scores.value = d.scores;
            });
        }
    };

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
        scores,
        initSocket
    };
}
