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

// Auto-clear error message after 4 seconds
watch(roomError, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      roomError.value = '';
    }, 4000);
  }
});
</script>

<template>
  <div class="relative z-10 flex flex-col items-center justify-center min-h-screen pt-24 pb-12 px-4">
    
    <!-- Title Section (Top Center) -->
    <RouterLink to="/" class="absolute top-8 left-1/2 -translate-x-1/2 text-center w-full group cursor-pointer">
      <h1 class="text-5xl md:text-7xl font-black text-white [text-shadow:0_2px_0_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)] tracking-tight group-hover:text-amber-400 transition-colors">
        BLIND<span class="text-amber-400 group-hover:text-white">TEST</span>
      </h1>
    </RouterLink>

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
          <p class="text-amber-300 text-center text-sm uppercase tracking-widest font-bold">Ton pseudo</p>
          <input v-model="usernameInput" @input="updateUsername" type="text"
                 placeholder="Ex: PetitPseudoCool" maxlength="20" autofocus
                 class="w-full bg-black/90 border border-white/20 text-center text-white placeholder:text-white px-4 py-4 text-xl font-bold outline-none focus:border-amber-400/60 transition-colors shadow-inner" />
        </div>
      </div>

      <!-- RIGHT PANEL: Room Actions -->
      <div class="flex flex-col gap-6 w-full max-w-sm justify-center">
        <!-- Create Room -->
        <button @click="createRoom" :disabled="isCreating || !usernameInput.trim()" 
                class="flex items-center gap-5 p-6 bg-[#080602]/95 border border-amber-400/25 border-l-4 border-l-amber-400/70 transition-all duration-150 cursor-pointer w-full hover:bg-black hover:border-amber-400/60 hover:translate-x-[3px] group disabled:opacity-50 disabled:cursor-not-allowed">
          <div class="text-left flex-1">
            <p class="font-bold text-xl text-white group-hover:text-amber-300 transition-colors">Créer une partie</p>
            <p class="text-white text-sm mt-1">Génère un code à partager</p>
          </div>
        </button>

        <!-- Join Room -->
        <div class="flex flex-col gap-5 p-6 bg-[#080602]/95 border border-amber-400/25 border-l-4 border-l-amber-400/70 transition-all duration-150 w-full hover:bg-black hover:border-amber-400/50"
             :class="{ 'opacity-50 pointer-events-none grayscale-[50%]': !usernameInput.trim() }">
          <div class="flex items-center gap-5">
            <div>
              <p class="font-bold text-xl text-white">Rejoindre</p>
              <p class="text-white text-sm mt-1">Entre le code du salon</p>
            </div>
          </div>
          <div class="flex gap-3 w-full mt-2">
            <input v-model="joinCodeInput" @keydown.enter="joinRoom" type="text"
                   placeholder="CODE" maxlength="5"
                   class="flex-1 w-0 min-w-0 bg-black/90 border border-white/20 text-white placeholder:text-white px-4 py-3 text-lg outline-none focus:border-amber-400/60 transition-colors uppercase tracking-[0.2em] text-center font-black shadow-inner" />
            <button @click="joinRoom" :disabled="!joinCodeInput.trim() || !usernameInput.trim()" 
                    class="shrink-0 whitespace-nowrap bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d0d1a] font-black text-sm tracking-widest uppercase py-3 px-5 border border-amber-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:from-amber-600 hover:to-amber-800 hover:-translate-y-[1px] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
              OK →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Notification (Floating Toast) -->
    <transition enter-active-class="transition-all duration-300 transform" enter-from-class="opacity-0 -translate-y-4"
                leave-active-class="transition-all duration-300 transform" leave-to-class="opacity-0 -translate-y-4">
      <div v-if="roomError" class="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-[0_0_30px_rgba(239,68,68,0.4)] z-[100] flex items-center gap-3 border border-white/20">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        {{ roomError }}
      </div>
    </transition>

  </div>
</template>
