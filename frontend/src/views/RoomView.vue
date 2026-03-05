<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGame } from '../composables/useGame';

const route = useRoute();
const router = useRouter();
const roomCode = route.params.code as string;

const { 
  username, avatarSeed, playerId, room, isHost, isConnected, roomError,
  scores, isLocked, lockedBy, lockedByName, answer, answerResult, timerRemaining, 
  trackRemaining, roundWinner, opponentTypingAnswer, socket, initSocket, leaveRoom, updateSettings 
} = useGame();

const answerInput = ref<HTMLInputElement | null>(null);

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
const playAgain = () => { if (socket.value && isHost.value) socket.value.emit('play_again'); };
const nextQuestion = () => { if (socket.value && isHost.value) socket.value.emit('next_question'); };
const buzz = () => { if (!isLocked.value && socket.value && isConnected.value) socket.value.emit('buzz', { playerId: playerId.value, username: username.value }); };
const submitAnswer = () => { if (!answer.value.trim() || !socket.value) return; socket.value.emit('submit_answer', { playerId: playerId.value, username: username.value, answer: answer.value.trim() }); };

const timerPercent = () => timerRemaining.value / 15;
const iAmLocker = computed(() => isLocked.value && lockedBy.value === playerId.value);

const sortedScores = computed(() => [...scores.value].sort((a, b) => b.score - a.score));

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
      socket.value.emit('join_room', { 
        code: roomCode, 
        playerId: playerId.value,
        username: username.value,
        avatarSeed: avatarSeed.value
      });
    }
  }
});

onUnmounted(() => {
  leaveRoom();
});

// Watch for room kick/disband
watch(room, (newRoom) => {
  if (!newRoom) {
     router.push('/');
  }
});

// Focus the answer input (called by transition hook)
const focusInput = () => {
  if (iAmLocker.value && answerInput.value) {
    answerInput.value.focus();
  }
};

// Emit typing events to the server in real-time
watch(answer, (newVal) => {
  if (iAmLocker.value && socket.value) {
    socket.value.emit('typing_answer', { answer: newVal });
  }
});

// Auto-clear room errors after 3 seconds
watch(roomError, (newError) => {
  if (newError) {
    setTimeout(() => {
      roomError.value = '';
    }, 3000);
  }
});
</script>

<template>
  <div class="relative z-10 flex flex-col min-h-screen">
    
    <!-- Global Room Header (Persistent) -->
    <header v-if="room" class="absolute top-0 left-0 right-0 z-50 flex flex-wrap md:flex-nowrap items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-gradient-to-b from-black/80 to-transparent gap-2">
      <RouterLink to="/" @click="leaveRoom" class="flex flex-col group cursor-pointer shrink-0">
        <span class="text-xl md:text-2xl font-black leading-none text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] [text-shadow:0_2px_0_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)] tracking-tighter group-hover:text-amber-400 transition-colors">
          BLIND<span class="text-amber-400 group-hover:text-white">TEST</span>
        </span>
        <span class="text-[8px] md:text-[10px] text-white uppercase tracking-[4px] mt-1 ml-0.5 group-hover:text-white transition-colors">Arena</span>
      </RouterLink>

      <!-- Error Toast -->
      <transition enter-active-class="transition-all duration-300 transform" enter-from-class="opacity-0 -translate-y-4"
                  leave-active-class="transition-all duration-300 transform" leave-to-class="opacity-0 -translate-y-4">
        <div v-if="roomError" class="absolute left-1/2 -translate-x-1/2 top-4 bg-red-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.4)] z-50 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {{ roomError }}
        </div>
      </transition>

      <!-- Question Info (Visible only during play) -->
      <div v-if="room?.phase === 'playing' && room?.currentQuestion" class="flex flex-col items-center">
        <div class="flex gap-2">
          <span class="px-2 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded">
            {{ room.currentQuestion.theme }}
          </span>
          <span class="px-2 py-0.5 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded">
            {{ room.currentQuestion.difficulty }}
          </span>
        </div>
        <p class="text-white font-bold text-sm mt-1 drop-shadow">{{ room.currentQuestion.text }}</p>
      </div>

      <!-- Right Side: Scores & Connection -->
      <div class="flex items-center gap-3 md:gap-6 w-full md:w-auto justify-end order-3 md:order-none">
        <!-- Scores (Mini view during game) -->
        <div v-if="room?.phase === 'playing'" class="flex items-center gap-2 overflow-x-auto max-w-full md:max-w-xs no-scrollbar">
          <div v-for="p in scores" :key="p.username"
               class="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 border text-[10px] md:text-xs font-bold whitespace-nowrap rounded-lg"
               :class="p.username === username
                 ? 'border-amber-400/60 bg-amber-400/25 text-amber-300'
                 : 'border-white/10 bg-black/60 text-white'">
            <div class="w-5 h-5 md:w-6 md:h-6 rounded-full overflow-hidden border border-white/10 shrink-0">
              <img :src="p.avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
            </div>
            <span class="max-w-[60px] md:max-w-none overflow-hidden text-ellipsis">{{ p.username }}</span>
            <span class="text-amber-400 ml-1">{{ p.score }}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2 md:gap-3 shrink-0">
          <div class="flex flex-col items-end hidden sm:flex">
            <span class="text-white text-[10px] font-mono leading-none">{{ room.code }}</span>
            <span class="text-[9px] uppercase tracking-widest mt-0.5" :class="isConnected ? 'text-green-400' : 'text-red-400'">
              {{ isConnected ? 'Online' : 'Offline' }}
            </span>
          </div>
          <span class="w-1.5 h-1.5 rounded-full"
                :class="isConnected ? 'bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]' : 'bg-red-400'"
                :title="room.code + ' - ' + (isConnected ? 'Online' : 'Offline')"></span>
        </div>
      </div>
    </header>

    <!-- ═══════════════ WAITING ROOM ═══════════════ -->
    <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="room && room.phase === 'waiting'" class="flex flex-col items-center justify-center min-h-screen gap-4 md:gap-6 w-full pt-16 md:pt-20 pb-4">

        <!-- Code display -->
        <div class="flex flex-col items-center gap-1 relative z-10 w-full max-w-[90%] md:max-w-none">
          <p class="text-white text-[10px] md:text-xs uppercase tracking-widest drop-shadow">Code du salon</p>
          <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] px-4 md:px-8 py-2 md:py-3 flex items-center justify-between w-full md:w-auto md:gap-4 rounded-xl">
            <span class="text-amber-400 font-black text-3xl md:text-4xl tracking-[6px] md:tracking-[8px]">{{ room.code }}</span>
            <button @click="copyCode" 
                    title="Copier le code"
                    class="p-2 ml-4 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 rounded transition-colors shrink-0"
                    :class="{ 'bg-green-500/20 text-green-400': copied }">
              <svg v-if="!copied" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </button>
          </div>
          <p class="text-white text-[10px] md:text-xs drop-shadow">Partage ce code avec tes amis</p>
        </div>

        <!-- Main content area: Settings + Players -->
        <div class="flex flex-col lg:flex-row items-center lg:items-start gap-8 w-full max-w-4xl justify-center px-4">
          
          <!-- Game Settings (Host only editable) -->
          <div v-if="room" class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-sm p-6 flex flex-col gap-6 order-2 lg:order-1 items-center md:items-stretch">
            <p class="text-amber-300 text-xs uppercase tracking-[0.2em] font-black mb-1 w-full text-center md:text-left">Paramètres de la partie</p>
            
            <!-- Theme -->
            <div class="flex flex-col gap-2 w-full items-center md:items-start">
              <label class="text-white/60 text-[10px] uppercase font-bold tracking-widest text-center md:text-left">Thématique</label>
              <div class="relative group w-full">
                <select v-if="isHost" 
                        :value="room.settings.theme"
                        @change="(e) => updateSettings({ ...room!.settings, theme: (e.target as HTMLSelectElement).value })"
                        class="w-full bg-black border border-white/10 text-white px-4 py-2.5 rounded-lg appearance-none focus:outline-none focus:border-amber-400/50 transition-colors cursor-pointer text-sm font-bold text-center md:text-left">
                  <option v-for="t in room.availableThemes" :key="t" :value="t" class="bg-black text-white">{{ t }}</option>
                </select>
                <div v-else class="w-full bg-black border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm font-bold opacity-80 text-center md:text-left">
                  {{ room.settings.theme }}
                </div>
                <svg v-if="isHost" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none group-hover:translate-y-[-40%] transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>

            <!-- Question Count & Duration (Grid) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div class="flex flex-col gap-2 items-center md:items-start">
                <label class="text-white/60 text-[10px] uppercase font-bold tracking-widest text-center md:text-left">Extraits</label>
                <div class="flex bg-white/5 p-1 rounded-lg border border-white/10 w-full">
                  <button v-for="count in [5, 10, 20]" 
                          :key="count"
                          @click="isHost && updateSettings({ ...room!.settings, questionCount: count })"
                          class="flex-1 py-1.5 text-xs font-black rounded-md transition-all"
                          :class="room.settings.questionCount === count 
                            ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.3)]' 
                            : 'text-white/40 hover:text-white pointer-events-auto cursor-pointer'">
                    {{ count }}
                  </button>
                </div>
              </div>
              
              <div class="flex flex-col gap-2 items-center md:items-start">
                <label class="text-white/60 text-[10px] uppercase font-bold tracking-widest text-center md:text-left">Temps / Extrait</label>
                <div class="flex bg-white/5 p-1 rounded-lg border border-white/10 w-full">
                  <button v-for="d in [15, 30, 45]" 
                          :key="d"
                          @click="isHost && updateSettings({ ...room!.settings, duration: d })"
                          class="flex-1 py-1.5 text-xs font-black rounded-md transition-all"
                          :class="room.settings.duration === d 
                            ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.3)]' 
                            : 'text-white/40 hover:text-white pointer-events-auto cursor-pointer'">
                    {{ d }}s
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Player list -->
          <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-xs p-5 flex flex-col gap-2 order-1 lg:order-2 items-center md:items-stretch">
            <p class="text-amber-300 text-xs uppercase tracking-[0.2em] font-black mb-2 w-full text-center md:text-left">Joueurs ({{ room.players.length }})</p>
            <div class="w-full flex flex-col items-center md:items-start">
              <div v-for="p in room.players" :key="p.username"
                  class="flex items-center justify-center md:justify-start gap-3 py-2 border-b border-white/5 last:border-0 relative w-full">
                <div class="w-10 h-10 rounded-full overflow-hidden bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <img :src="p.avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
                </div>
                <span class="text-white font-bold text-center md:text-left max-w-[120px] overflow-hidden text-ellipsis">{{ p.username }}</span>
                <div class="absolute right-0 md:relative md:ml-auto md:right-auto flex items-center">
                  <span v-if="p.playerId === room.hostPlayerId" class="text-yellow-300" title="Hôte">
                    <svg class="w-4 h-4 drop-shadow-[0_0_5px_rgba(253,224,71,0.5)]" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 2L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z"/></svg>
                  </span>
                  <span v-else-if="p.playerId === playerId" class="text-white text-xs opacity-50">toi</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <button v-if="isHost" @click="startGame" 
                class="bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-base tracking-widest uppercase px-10 py-3 border border-amber-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:from-amber-600 hover:to-amber-800 hover:shadow-[0_4px_24px_rgba(251,191,36,0.4)] hover:-translate-y-[1px] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mt-4">
          Lancer la partie !
        </button>
        <p v-else class="text-white text-sm">En attente que le host lance…</p>
      </div>
    </transition>

    <!-- ═══════════════ GAME ═══════════════ -->
    <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="room && (room.phase === 'playing' || room.phase === 'finished')" class="flex flex-col flex-1 w-full pt-16">
        <!-- ... all game logic UI ... -->
        <main class="relative flex flex-col items-center justify-center flex-1 gap-10 px-4 pb-10">
          
          <!-- FINISHED PHASE (LEADERBOARD) -->
          <transition enter-active-class="transition-all duration-700 delay-300" enter-from-class="opacity-0 translate-y-4" leave-active-class="transition-all duration-300" leave-to-class="opacity-0">
            <div v-if="room?.phase === 'finished'" class="flex flex-col items-center w-full max-w-2xl mt-4 z-10">
              <h2 class="flex items-center justify-center gap-4 text-4xl sm:text-5xl font-black text-amber-500 uppercase tracking-widest mb-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)] text-center">
                <svg class="w-10 h-10 sm:w-12 sm:h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M19,5h-2V3H7v2H5C3.9,5,3,5.9,3,7v1c0,2.5,1.9,4.6,4.3,4.9c0.7,1.5,2.1,2.7,3.7,3V19H7v2h10v-2h-4v-3.1 c1.6-0.3,3-1.5,3.7-3c2.4-0.3,4.3-2.4,4.3-4.9V7C21,5.9,20.1,5,19,5z M5,8V7h2v3.8C5.8,10.4,5,9.3,5,8z M19,8c0,1.3-0.8,2.4-2,2.8V7 h2V8z"/></svg>
                CLASSEMENT FINAL
                <svg class="w-10 h-10 sm:w-12 sm:h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M19,5h-2V3H7v2H5C3.9,5,3,5.9,3,7v1c0,2.5,1.9,4.6,4.3,4.9c0.7,1.5,2.1,2.7,3.7,3V19H7v2h10v-2h-4v-3.1 c1.6-0.3,3-1.5,3.7-3c2.4-0.3,4.3-2.4,4.3-4.9V7C21,5.9,20.1,5,19,5z M5,8V7h2v3.8C5.8,10.4,5,9.3,5,8z M19,8c0,1.3-0.8,2.4-2,2.8V7 h2V8z"/></svg>
              </h2>
              <div class="flex flex-col w-full gap-4">
                <div v-for="(p, index) in sortedScores" :key="p.username" 
                     class="flex items-center justify-between p-5 rounded-2xl border transition-all duration-300"
                     :class="[
                       index === 0 ? 'bg-amber-500/50 border-amber-500/50 shadow-[0_0_30px_rgba(251,191,36,0.3)] scale-[1.02]' : 
                       index === 1 ? 'bg-gray-400/35 border-gray-400/30' : 
                       index === 2 ? 'bg-orange-700/35 border-orange-700/30' : 
                       'bg-white/20 border-white/10 opacity-90'
                     ]">
                  <div class="flex items-center gap-3 md:gap-5">
                    <span class="text-2xl md:text-3xl font-black w-8 md:w-10 text-center" 
                          :class="index === 0 ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-white'">
                      #{{ index + 1 }}
                    </span>
                    <div class="w-10 h-10 md:w-14 md:h-14 rounded-full overflow-hidden border-2 shrink-0"
                         :class="index === 0 ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'border-white/20'">
                      <img :src="p.avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
                    </div>
                    <span class="text-xl md:text-2xl font-bold text-white tracking-wide max-w-[100px] md:max-w-[200px] overflow-hidden text-ellipsis">{{ p.username }}</span>
                  </div>
                   <span class="text-xl md:text-2xl font-black tabular-nums" :class="index === 0 ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'text-white'">{{ p.score }} pts</span>
                </div>
              </div>

              <div class="mt-14 flex flex-col items-center gap-4">
                <button v-if="isHost" @click="playAgain"
                        class="flex items-center gap-3 bg-gradient-to-tr from-amber-600 to-amber-400 text-[#0d0d1a] font-black text-xl uppercase tracking-widest py-4 px-12 rounded-full border-2 border-amber-300/50 shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_50px_rgba(251,191,36,0.6)] hover:from-amber-500 hover:to-amber-300 active:scale-95 cursor-pointer">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  RETOUR AU SALON
                </button>
                <div v-else class="text-amber-500 font-bold uppercase tracking-widest animate-pulse text-sm mt-4">
                  En attente de l'hôte pour retourner au salon...
                </div>
              </div>
            </div>
          </transition>

          <!-- ROUND WON OVERLAY -->
          <transition enter-active-class="transition-all duration-500 ease-out" enter-from-class="opacity-0 scale-90" 
                      leave-active-class="transition-all duration-300 ease-in" leave-to-class="opacity-0 scale-110">
            <div v-if="roundWinner" class="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
              <div class="flex flex-col items-center text-center p-8 bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-400/30 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.15)] max-w-2xl w-full mx-4">
                <span class="text-amber-400 font-black text-xl tracking-[0.2em] mb-2 uppercase">
                  {{ roundWinner.user === 'Personne' ? 'Temps Écoulé !' : 'Bonne Réponse !' }}
                </span>
                
                <span v-if="roundWinner.user === 'Personne'" class="text-white/70 text-sm md:text-base mb-1 uppercase tracking-widest font-bold">
                  L'extrait était :
                </span>
                
                <span class="text-white text-4xl sm:text-5xl font-black drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)] mb-6 text-center leading-tight">
                  {{ roundWinner.correctAnswer }}
                </span>
                
                <div v-if="roundWinner.user !== 'Personne'" class="flex flex-col md:flex-row items-center gap-2 md:gap-3 bg-white/5 border border-white/10 px-6 py-2 md:py-3 rounded-xl md:rounded-full">
                  <span class="text-white text-sm md:text-base text-center">Astucieusement trouvé par</span>
                  <span class="text-green-400 font-bold text-lg md:text-xl">{{ roundWinner.user }}</span>
                  <span class="text-amber-400 font-black text-sm md:text-base">+100</span>
                </div>
                <div class="mt-8 text-white text-xs uppercase tracking-widest animate-pulse">
                  Prochain extrait imminent...
                </div>
              </div>
            </div>
          </transition>

          <!-- Track Timer Progress -->
          <div v-if="room?.currentQuestion && room?.phase !== 'finished'" class="w-full max-w-2xl px-4 mt-2 md:mt-4">
            <div class="flex justify-between text-[10px] sm:text-xs font-black tracking-widest sm:tracking-[0.2em] text-white mb-2 uppercase">
              <span class="opacity-80">Temps Restant</span>
              <span class="font-mono text-sm" :class="trackRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-400'">
                00:{{ trackRemaining.toString().padStart(2, '0') }}
              </span>
            </div>
            <div class="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
              <div class="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000 ease-linear rounded-full"
                   :class="{'from-red-600 to-red-400': trackRemaining <= 10}"
                   :style="{ width: `${(trackRemaining / room.settings.duration) * 100}%` }"></div>
            </div>
          </div>

          <div v-if="room?.phase !== 'finished' && isLocked" class="flex flex-col items-center gap-4 min-h-[60px] justify-center mt-2">
            <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-center min-w-[200px] sm:min-w-[260px] flex items-center justify-center gap-2 rounded-xl">
              <template v-if="iAmLocker">
                <svg class="w-5 h-5 text-green-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span class="text-green-300 animate-pulse">C'EST À TOI !</span>
              </template>
              <template v-else>
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span class="text-red-300">{{ lockedByName }} a buzzé !</span>
              </template>
            </div>
          </div>
          <div v-else-if="room?.phase !== 'finished'" class="min-h-[60px]"></div>

          <!-- Buzzer -->
          <div v-if="room?.phase !== 'finished'" class="relative flex items-center justify-center mt-6 sm:mt-10">
            <!-- Ping rings -->
            <div v-if="!isLocked" class="absolute w-[280px] h-[280px] sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full border border-amber-400/10 animate-[ping_2.5s_linear_infinite] pointer-events-none"></div>
            <div v-if="!isLocked" class="absolute w-[250px] h-[250px] sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full border border-amber-400/15 pointer-events-none"></div>

            <svg v-if="isLocked" class="absolute w-[250px] h-[250px] sm:w-72 sm:h-72 md:w-80 md:h-80 -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
              <circle cx="50" cy="50" r="46" fill="none"
                :stroke="iAmLocker ? 'rgba(74,222,128,0.8)' : 'rgba(248,113,113,0.6)'"
                stroke-width="3" stroke-linecap="round"
                :stroke-dasharray="`${timerPercent() * 289} 289`"
                style="transition: stroke-dasharray 0.9s linear;"/>
            </svg>

            <div v-if="isLocked" class="absolute -top-16 sm:-top-20 font-black text-2xl sm:text-3xl tabular-nums"
                 :class="iAmLocker ? 'text-green-300' : 'text-white'">
              {{ timerRemaining }}s
            </div>

            <button id="buzzer-btn" @click="buzz" :disabled="isLocked || !isConnected"
                    class="relative w-52 h-52 sm:w-60 sm:h-60 md:w-72 md:h-72 rounded-full font-black text-lg sm:text-xl md:text-2xl tracking-widest uppercase transition-all duration-150 outline-none touch-manipulation shadow-[0_10px_30px_rgba(0,0,0,0.5)] active:translate-y-2"
                    :class="!isLocked
                      ? 'bg-gradient-to-b from-amber-600 to-amber-900 border-2 border-amber-400/50 shadow-[inset_0_8px_16px_rgba(251,191,36,0.4),0_0_40px_rgba(251,191,36,0.3)] hover:scale-105 active:scale-95 text-white'
                      : iAmLocker
                        ? 'bg-gradient-to-b from-green-500 to-green-800 border-2 border-green-400/50 shadow-[inset_0_8px_16px_rgba(74,222,128,0.4),0_0_60px_rgba(74,222,128,0.4)] scale-105 cursor-not-allowed text-white text-shadow-sm'
                        : 'bg-gradient-to-b from-gray-800 to-black border-2 border-white/10 scale-95 cursor-not-allowed text-white/50'">
              <span class="absolute top-[10%] left-[20%] w-[30%] h-[15%] bg-white/20 rounded-full blur-sm -rotate-12 pointer-events-none"></span>
              <span v-if="!isLocked">BUZZER</span>
              <span v-else-if="iAmLocker" class="text-base">À TOI !</span>
              <span v-else class="text-sm">BLOQUÉ</span>
            </button>
          </div>

          <!-- Answer box -->
          <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                      leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0" 
                      mode="out-in"
                      @after-enter="focusInput">
            <div v-if="iAmLocker && room?.phase !== 'finished'" key="answer-box" class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32_rgba(0,0,0,0.6)] w-full max-w-sm p-5 space-y-3">
              <p class="text-amber-300 text-xs uppercase tracking-[0.2em] font-black">Ta réponse</p>
              <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" 
                          leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0" mode="out-in">
                <div v-if="answerResult?.correct === true" key="ok"
                     class="flex items-center justify-center gap-2 py-2 border border-green-500/40 bg-green-500/10 text-green-300 font-bold text-sm">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                  Bonne réponse ! +100 pts
                </div>
                <div v-else-if="answerResult?.correct === false" key="ko"
                     class="flex items-center justify-center gap-2 py-2 border border-red-500/40 bg-red-500/10 text-red-300 font-bold text-sm">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                  Mauvaise réponse…
                </div>
              </transition>
              <div class="flex gap-2">
                <input v-model="answer" @keydown.enter="submitAnswer" type="text"
                       ref="answerInput"
                       placeholder="Tape ta réponse ici…"
                       class="flex-1 bg-black/90 border border-white/10 text-white placeholder:text-white px-4 py-2.5 text-base outline-none focus:border-amber-400/60 transition-colors" />
                <button @click="submitAnswer" :disabled="!answer.trim()"
                        class="bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-sm tracking-widest uppercase py-2.5 px-4 border border-amber-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:from-amber-600 hover:to-amber-800 hover:shadow-[0_4px_24px_rgba(251,191,36,0.4)] hover:-translate-y-[1px] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
            </div>
            <div v-else-if="isLocked" key="hint" class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] px-6 py-3 text-white text-sm text-center min-w-[300px]">
              <div class="flex flex-col items-center gap-1">
                <span class="text-amber-400/80 text-[10px] font-black tracking-widest uppercase">{{ lockedByName }} est en train de répondre…</span>
                <span class="text-lg font-bold min-h-[1.75rem] flex items-center italic text-white/90">
                  {{ opponentTypingAnswer || '...' }}
                </span>
              </div>
            </div>
            <div v-else key="empty" class="h-20"></div>
          </transition>
        </main>
      </div>
    </transition>
  </div>
</template>
