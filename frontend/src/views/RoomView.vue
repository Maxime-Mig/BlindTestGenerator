<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGame } from '../composables/useGame';

const route = useRoute();
const router = useRouter();
const roomCode = route.params.code as string;

const { 
  username, room, isHost, isConnected, 
  scores, isLocked, lockedBy, answer, answerResult, timerRemaining, 
  socket, initSocket 
} = useGame();

const copied = ref(false);
const copyCode = async () => {
  if (!room.value?.code) return;
  try {
    await navigator.clipboard.writeText(room.value.code);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (err) {
    console.error('Failed to copy', err);
  }
};

const startGame = () => { if (socket.value && isHost.value) socket.value.emit('start_game'); };
const nextQuestion = () => { if (socket.value && isHost.value) socket.value.emit('next_question'); };
const buzz = () => { if (!isLocked.value && socket.value && isConnected.value) socket.value.emit('buzz', { username: username.value }); };
const submitAnswer = () => { if (!answer.value.trim() || !socket.value) return; socket.value.emit('submit_answer', { username: username.value, answer: answer.value.trim() }); };

const timerPercent = () => timerRemaining.value / 15;
const iAmLocker = () => isLocked.value && lockedBy.value === username.value;

onMounted(() => {
  initSocket();
  
  if (!username.value) {
    // Cannot join a room without a username.
    // In a more complex app, we'd prompt for pseudo here.
    // For now, redirect to home.
    router.push('/');
    return;
  }

  // Join the room if not already in it
  if (!room.value || room.value.code !== roomCode) {
    if (socket.value) {
      socket.value.emit('join_room', { code: roomCode, username: username.value });
    }
  }
});

// Watch for room kick/disband
watch(room, (newRoom) => {
  if (!newRoom) {
     router.push('/');
  }
});
</script>

<template>
  <div class="relative z-10 flex flex-col min-h-screen">
    
    <!-- ═══════════════ WAITING ROOM ═══════════════ -->
    <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="room && room.phase === 'waiting'" class="flex flex-col items-center justify-center min-h-screen gap-6 w-full">
        <h1 class="text-4xl font-black text-white [text-shadow:0_0_20px_rgba(251,191,36,0.4),0_2px_0_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)]">
          BLIND<span class="text-amber-400">TEST</span>
        </h1>

        <!-- Code display -->
        <div class="flex flex-col items-center gap-1 relative">
          <p class="text-white/40 text-xs uppercase tracking-widest">Code du salon</p>
          <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] px-8 py-3 flex items-center gap-4">
            <span class="text-amber-400 font-black text-4xl tracking-[8px]">{{ room.code }}</span>
            <button @click="copyCode" 
                    title="Copier le code"
                    class="p-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 rounded transition-colors"
                    :class="{ 'bg-green-500/20 text-green-400': copied }">
              <span v-if="!copied">📋</span>
              <span v-else>✅</span>
            </button>
          </div>
          <p class="text-white/30 text-xs">Partage ce code avec tes amis</p>
        </div>

        <!-- Player list -->
        <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-xs p-5 flex flex-col gap-2">
          <p class="text-amber-300/70 text-xs uppercase tracking-widest mb-2">Joueurs ({{ room.players.length }})</p>
          <div v-for="p in room.players" :key="p.username"
               class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <span class="w-8 h-8 flex items-center justify-center bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm font-black">
              {{ p.username.charAt(0).toUpperCase() }}
            </span>
            <span class="font-semibold text-sm">{{ p.username }}</span>
            <span v-if="p.username === room.hostUsername" class="ml-auto text-yellow-300 text-xs font-bold">👑</span>
            <span v-else-if="p.username === username" class="ml-auto text-white/25 text-xs">toi</span>
          </div>
        </div>

        <button v-if="isHost" @click="startGame" 
                class="bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-base tracking-widest uppercase px-10 py-3 border border-amber-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:from-amber-600 hover:to-amber-800 hover:shadow-[0_4px_24px_rgba(251,191,36,0.4)] hover:-translate-y-[1px] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
          Lancer la partie !
        </button>
        <p v-else class="text-white/40 text-sm">En attente que le host lance…</p>
      </div>
    </transition>

    <!-- ═══════════════ GAME ═══════════════ -->
    <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="room && room.phase === 'playing'" class="flex flex-col flex-1 w-full">
        <!-- ... all game logic UI ... -->
        <!-- Header -->
        <header class="flex items-center justify-between px-6 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <div class="flex flex-col">
            <span class="text-2xl font-black leading-none text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] [text-shadow:0_2px_0_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)] tracking-tighter">
              BLIND<span class="text-amber-400">TEST</span>
            </span>
            <span class="text-[10px] text-white/30 uppercase tracking-[4px] mt-1 ml-0.5">Arena</span>
          </div>

          <!-- Question Info -->
          <div v-if="room?.currentQuestion" class="flex flex-col items-center">
            <div class="flex gap-2">
              <span class="px-2 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded">
                {{ room.currentQuestion.theme }}
              </span>
              <span class="px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest rounded">
                {{ room.currentQuestion.difficulty }}
              </span>
            </div>
            <p class="text-white font-bold text-sm mt-1 drop-shadow">{{ room.currentQuestion.text }}</p>
          </div>

          <!-- Scores -->
          <div class="flex items-center gap-2 overflow-x-auto max-w-[30%]">
            <div v-for="p in scores" :key="p.username"
                 class="flex items-center gap-1.5 px-3 py-1 border text-xs font-bold whitespace-nowrap"
                 :class="p.username === username
                   ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                   : 'border-white/10 bg-black/20 text-white/40'">
              <span>{{ p.username }}</span>
              <span class="text-amber-400">{{ p.score }}</span>
            </div>
          </div>
          
          <div class="flex items-center gap-3">
            <div class="flex flex-col items-end">
              <span class="text-white/30 text-[10px] font-mono leading-none">{{ room?.code }}</span>
              <span class="text-[9px] uppercase tracking-widest mt-0.5" :class="isConnected ? 'text-green-400' : 'text-red-400'">
                {{ isConnected ? 'Online' : 'Offline' }}
              </span>
            </div>
            <span class="w-1.5 h-1.5 rounded-full"
                  :class="isConnected ? 'bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]' : 'bg-red-400'"></span>
          </div>
        </header>

        <!-- Game area -->
        <main class="flex flex-col items-center justify-center flex-1 gap-10 px-4 pb-10">
          <div class="flex flex-col items-center gap-4 min-h-[100px] justify-center">
            <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] px-6 py-2.5 text-sm font-bold text-center min-w-[260px]">
              <span v-if="!isLocked" class="text-white/50">Prêt pour la question ?</span>
              <span v-else-if="iAmLocker()" class="text-green-300 animate-pulse">🔥 RÉPONDS !</span>
              <span v-else class="text-red-300">⚡ {{ lockedBy }} a buzzé !</span>
            </div>
            
            <button v-if="isHost && !isLocked" @click="nextQuestion"
                    class="bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-[10px] tracking-widest uppercase py-1.5 px-4 rounded border border-amber-500/50 transition-all duration-150 shadow-lg hover:from-amber-600 hover:to-amber-800 hover:-translate-y-[1px] active:scale-[0.97] cursor-pointer">
              QUESTION SUIVANTE »
            </button>
          </div>

          <!-- Buzzer -->
          <div class="relative flex items-center justify-center">
            <div v-if="!isLocked" class="absolute w-80 h-80 rounded-full border border-amber-400/10 animate-[ping_2.5s_linear_infinite]"></div>
            <div v-if="!isLocked" class="absolute w-72 h-72 rounded-full border border-amber-400/15"></div>

            <svg v-if="isLocked" class="absolute w-72 h-72 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
              <circle cx="50" cy="50" r="46" fill="none"
                :stroke="iAmLocker() ? 'rgba(74,222,128,0.8)' : 'rgba(248,113,113,0.6)'"
                stroke-width="3" stroke-linecap="round"
                :stroke-dasharray="`${timerPercent() * 289} 289`"
                style="transition: stroke-dasharray 0.9s linear;"/>
            </svg>

            <div v-if="isLocked" class="absolute -top-16 font-black text-3xl tabular-nums"
                 :class="iAmLocker() ? 'text-green-300' : 'text-white/60'">
              {{ timerRemaining }}s
            </div>

            <button id="buzzer-btn" @click="buzz" :disabled="isLocked || !isConnected"
                    class="relative w-60 h-60 rounded-full font-black text-xl tracking-widest uppercase transition-all duration-150 outline-none"
                    :class="!isLocked
                      ? 'bg-[radial-gradient(circle_at_40%_35%,rgba(251,191,36,0.2),rgba(0,0,0,0.5))] border-2 border-amber-400/50 shadow-[0_0_40px_rgba(251,191,36,0.2),inset_0_0_30px_rgba(251,191,36,0.05),0_0_0_8px_rgba(251,191,36,0.05)] hover:scale-105 active:scale-95 text-white'
                      : iAmLocker()
                        ? 'bg-[radial-gradient(circle_at_40%_35%,rgba(74,222,128,0.25),rgba(0,0,0,0.5))] border-2 border-green-400/50 shadow-[0_0_60px_rgba(74,222,128,0.3),inset_0_0_30px_rgba(74,222,128,0.08)] scale-105 cursor-not-allowed text-green-300'
                        : 'bg-black/40 border-2 border-white/10 scale-95 cursor-not-allowed text-white/15'">
              <span class="absolute top-5 left-10 w-16 h-6 bg-white/5 rounded-full blur-md -rotate-12 pointer-events-none"></span>
              <span v-if="!isLocked">BUZZER</span>
              <span v-else-if="iAmLocker()" class="text-base">À TOI !</span>
              <span v-else class="text-sm">BLOQUÉ</span>
            </button>
          </div>

          <!-- Answer box -->
          <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                      leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0" mode="out-in">
            <div v-if="iAmLocker()" key="answer-box" class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-sm p-5 space-y-3">
              <p class="text-amber-300/70 text-xs uppercase tracking-widest">Ta réponse</p>
              <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                          leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0" mode="out-in">
                <div v-if="answerResult?.correct === true" key="ok"
                     class="text-center py-2 border border-green-500/40 bg-green-500/10 text-green-300 font-bold text-sm">
                  ✅ Bonne réponse ! +100 pts
                </div>
                <div v-else-if="answerResult?.correct === false" key="ko"
                     class="text-center py-2 border border-red-500/40 bg-red-500/10 text-red-300 font-bold text-sm">
                  ❌ Mauvaise réponse…
                </div>
              </transition>
              <div class="flex gap-2">
                <input v-model="answer" @keydown.enter="submitAnswer" type="text"
                       placeholder="Tape ta réponse ici…" autofocus
                       class="flex-1 bg-black/90 border border-white/10 text-white placeholder:text-white/25 px-4 py-2.5 text-base outline-none focus:border-amber-400/60 transition-colors" />
                <button @click="submitAnswer" :disabled="!answer.trim()"
                        class="bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-sm tracking-widest uppercase py-2.5 px-4 border border-amber-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:from-amber-600 hover:to-amber-800 hover:shadow-[0_4px_24px_rgba(251,191,36,0.4)] hover:-translate-y-[1px] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  ✓
                </button>
              </div>
            </div>
            <div v-else-if="isLocked" key="hint" class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] px-6 py-3 text-white/35 text-sm text-center">
              {{ lockedBy }} est en train de répondre…
            </div>
            <div v-else key="empty" class="h-20"></div>
          </transition>
        </main>
      </div>
    </transition>
  </div>
</template>
