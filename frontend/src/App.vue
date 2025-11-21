<script setup lang="ts">
import { Music } from 'lucide-vue-next'
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

    <main class="w-full flex justify-center">
      <router-view />
    </main>
    
    <footer class="mt-12 text-slate-500 text-sm">
      Powered by Python & Vue 3
    </footer>
  </div>
</template>
