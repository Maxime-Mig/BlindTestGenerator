<script setup lang="ts">
import { ref } from 'vue'
import GameInterface from './components/GameInterface.vue'
import { Music } from 'lucide-vue-next'

const gameStarted = ref(false)
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
    <header class="mb-8 text-center">
      <div class="flex items-center justify-center gap-3 mb-2">
        <Music class="w-10 h-10 text-purple-500" />
        <h1 class="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Blind Test Generator
        </h1>
      </div>
      <p class="text-slate-400">Test your musical knowledge!</p>
    </header>

    <main class="w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden p-6">
      <div v-if="!gameStarted" class="text-center py-10">
        <h2 class="text-2xl font-semibold mb-6">Ready to play?</h2>
        <button
          @click="gameStarted = true"
          class="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg"
        >
          Start Game
        </button>
      </div>
      <GameInterface v-else />
    </main>
    
    <footer class="mt-12 text-slate-500 text-sm">
      Powered by Node.js & Vue 3
    </footer>
  </div>
</template>
