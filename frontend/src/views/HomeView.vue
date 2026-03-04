<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGame } from '../composables/useGame';

const router = useRouter();
const { username, room, roomError, socket, initSocket } = useGame();

const isCreating = ref(false);
const usernameInput = ref(username.value || '');
const joinCodeInput = ref('');

onMounted(() => {
  initSocket();
});

const updateUsername = () => {
  username.value = usernameInput.value.trim();
};

const createRoom = () => {
  if (!usernameInput.value.trim() || !socket.value) return;
  // Ensure the global username is updated before emitting
  username.value = usernameInput.value.trim();
  isCreating.value = true;
  roomError.value = '';
  socket.value.emit('create_room', { username: username.value });
};

const joinRoom = () => {
  const c = joinCodeInput.value.trim().toUpperCase();
  if (!c || !usernameInput.value.trim() || !socket.value) return;
  // Ensure the global username is updated before emitting
  username.value = usernameInput.value.trim();
  roomError.value = '';
  socket.value.emit('join_room', { code: c, username: username.value });
};

// When create_room/join_room succeeds, the backend sends 'room_joined'.
// We watch the room state, and if it's set, we navigate to the room code.
watch(room, (newRoom) => {
  if (newRoom && newRoom.code) {
    // Only navigate if we are currently not on that route
    if (router.currentRoute.value.path !== `/${newRoom.code}`) {
       router.push(`/${newRoom.code}`);
    }
  }
});
</script>

<template>
  <div class="relative z-10 flex flex-col items-center justify-center min-h-screen pt-24 pb-12 px-4">
    
    <!-- Title Section (Top Center) -->
    <div class="absolute top-8 left-1/2 -translate-x-1/2 text-center w-full">
      <h1 class="text-5xl md:text-7xl font-black text-white [text-shadow:0_2px_0_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)] tracking-tight">
        BLIND<span class="text-amber-400">TEST</span>
      </h1>
      <p class="text-white/50 text-xs md:text-sm mt-2 tracking-[6px] uppercase font-bold">Geek Culture Edition</p>
    </div>

    <!-- Main Content Container (Side by Side on large screens) -->
    <div class="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-10 lg:gap-16 w-full max-w-5xl mt-6">
      
      <!-- LEFT PANEL: Pseudo Selection & Avatar -->
      <div class="bg-[#080602]/95 border border-amber-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-xs p-8 flex flex-col items-center justify-center gap-8">
        
        <!-- Avatar -->
        <div class="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/5 border-4 border-amber-400/40 flex items-center justify-center text-6xl font-black text-amber-300 transition-all duration-300"
             :class="{ 'scale-105 border-amber-400': usernameInput.trim() }">
          {{ usernameInput.trim() ? usernameInput.trim().charAt(0).toUpperCase() : '?' }}
        </div>
        
        <div class="w-full flex flex-col gap-3">
          <p class="text-amber-300/80 text-center text-sm uppercase tracking-widest font-bold">Ton pseudo</p>
          <input v-model="usernameInput" @input="updateUsername" type="text"
                 placeholder="Ex: Naruto_Fan42" maxlength="20" autofocus
                 class="w-full bg-black/90 border border-white/20 text-center text-white placeholder:text-white/25 px-4 py-4 text-xl font-bold outline-none focus:border-amber-400/60 transition-colors shadow-inner" />
        </div>
      </div>

      <!-- RIGHT PANEL: Room Actions -->
      <div class="flex flex-col gap-6 w-full max-w-sm justify-center">
        <!-- Create Room -->
        <button @click="createRoom" :disabled="isCreating || !usernameInput.trim()" 
                class="flex items-center gap-5 p-6 bg-[#080602]/95 border border-amber-400/25 border-l-4 border-l-amber-400/70 transition-all duration-150 cursor-pointer w-full hover:bg-black hover:border-amber-400/60 hover:translate-x-[3px] group disabled:opacity-50 disabled:cursor-not-allowed">
          <span class="text-4xl shrink-0 group-hover:scale-110 transition-transform">🎮</span>
          <div class="text-left flex-1">
            <p class="font-bold text-xl text-white group-hover:text-amber-300 transition-colors">Créer une partie</p>
            <p class="text-white/40 text-sm mt-1">Génère un code à partager</p>
          </div>
        </button>

        <!-- Join Room -->
        <div class="flex flex-col gap-5 p-6 bg-[#080602]/95 border border-amber-400/25 border-l-4 border-l-amber-400/70 transition-all duration-150 w-full hover:bg-black hover:border-amber-400/50"
             :class="{ 'opacity-50 pointer-events-none grayscale-[50%]': !usernameInput.trim() }">
          <div class="flex items-center gap-5">
            <span class="text-4xl shrink-0">🔗</span>
            <div>
              <p class="font-bold text-xl text-white">Rejoindre</p>
              <p class="text-white/40 text-sm mt-1">Entre le code du salon</p>
            </div>
          </div>
          <div class="flex gap-3 w-full mt-2">
            <input v-model="joinCodeInput" @keydown.enter="joinRoom" type="text"
                   placeholder="CODE" maxlength="5"
                   class="flex-1 w-0 min-w-0 bg-black/90 border border-white/20 text-white placeholder:text-white/25 px-4 py-3 text-lg outline-none focus:border-amber-400/60 transition-colors uppercase tracking-[0.2em] text-center font-black shadow-inner" />
            <button @click="joinRoom" :disabled="!joinCodeInput.trim() || !usernameInput.trim()" 
                    class="shrink-0 whitespace-nowrap bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-sm tracking-widest uppercase py-3 px-5 border border-amber-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:from-amber-600 hover:to-amber-800 hover:-translate-y-[1px] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
              OK →
            </button>
          </div>
        </div>
        
        <p v-if="roomError" class="text-red-400 text-sm font-bold mt-1 text-center bg-black/60 py-2 border border-red-500/30 rounded backdrop-blur-sm shadow-lg">⚠ {{ roomError }}</p>
      </div>

    </div>
  </div>
</template>
