<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { Play, Pause, Check, X, RefreshCw, Volume2, Home } from 'lucide-vue-next'

const API_URL = 'http://localhost:8000/api/game'
const router = useRouter()
const route = useRoute()

interface Song {
  songId: number
  clipUrl: string
}

interface Result {
  correct: boolean
  title: string
  artist: string
}

const filters = computed(() => {
  if (route.query.filters) {
    return JSON.parse(route.query.filters as string)
  }
  return { types: [], difficulties: [] }
})

const loading = ref(false)
const currentSong = ref<Song | null>(null)
const guess = ref('')
const result = ref<Result | null>(null)
const isPlaying = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)

const startNewRound = async () => {
  loading.value = true
  result.value = null
  guess.value = ''
  isPlaying.value = false
  try {
    // Build query params
    const params = new URLSearchParams()
    filters.value.types.forEach((t: string) => params.append('types', t))
    filters.value.difficulties.forEach((d: string) => params.append('difficulties', d))
    
    const res = await axios.get(`${API_URL}/start`, { params })
    currentSong.value = res.data
    // Reset audio
    if (audioRef.value) {
      audioRef.value.src = `http://localhost:8000${res.data.clipUrl}`
      audioRef.value.load()
    }
  } catch (err) {
    console.error("Error starting round:", err)
    alert("Failed to start round. Make sure backend is running and music is scanned.")
  } finally {
    loading.value = false
  }
}

const handlePlayToggle = () => {
  if (audioRef.value) {
    if (isPlaying.value) {
      audioRef.value.pause()
    } else {
      audioRef.value.play()
    }
    isPlaying.value = !isPlaying.value
  }
}

const handleSubmit = async () => {
  if (!guess.value.trim() || !currentSong.value) return

  try {
    const res = await axios.post(`${API_URL}/guess`, {
      songId: currentSong.value.songId,
      guess: guess.value
    })
    result.value = res.data
    isPlaying.value = false
    if (audioRef.value) audioRef.value.pause()
  } catch (err) {
    console.error("Error submitting guess:", err)
  }
}

const goHome = () => {
  router.push('/')
}

// Handle audio ended
const handleEnded = () => {
  isPlaying.value = false
}

onMounted(() => {
  startNewRound()
  if (audioRef.value) {
    audioRef.value.addEventListener('ended', handleEnded)
  }
})

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.removeEventListener('ended', handleEnded)
  }
})
</script>

<template>
  <div class="w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden p-6 relative">
    <!-- Home Button -->
    <button
      @click="goHome"
      class="absolute top-4 left-4 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2 text-slate-300 hover:text-white"
      title="Back to home"
    >
      <Home :size="20" />
      <span class="text-sm font-medium">Home</span>
    </button>

    <div class="flex flex-col gap-6 mt-8">
    <div v-if="loading && !currentSong" class="text-center py-10 text-slate-300">
      Loading next song...
    </div>

    <template v-else>
      <!-- Audio Player Section -->
      <div class="flex flex-col items-center justify-center bg-slate-900/50 p-6 rounded-xl border border-slate-700">
        <div class="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg animate-pulse-slow">
          <Volume2 class="w-10 h-10 text-white" />
        </div>
        
        <audio ref="audioRef" class="hidden" />
        
        <button
          @click="handlePlayToggle"
          class="flex items-center gap-2 px-6 py-2 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors"
        >
          <span v-if="isPlaying" class="flex items-center gap-2"><Pause :size="20" /> Pause</span>
          <span v-else class="flex items-center gap-2"><Play :size="20" /> Play Clip</span>
        </button>
      </div>

      <!-- Guess Section -->
      <form v-if="!result" @submit.prevent="handleSubmit" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-400">What's this song?</label>
          <input
            type="text"
            v-model="guess"
            placeholder="Enter title or artist..."
            class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-white placeholder-slate-500"
            autofocus
          />
        </div>
        <button
          type="submit"
          :disabled="!guess.trim()"
          class="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Guess
        </button>
      </form>

      <div v-else class="animate-fade-in">
        <div :class="['p-4 rounded-lg border mb-6', result.correct ? 'bg-green-900/30 border-green-500/50' : 'bg-red-900/30 border-red-500/50']">
          <div class="flex items-center gap-3 mb-2">
            <Check v-if="result.correct" class="w-6 h-6 text-green-400" />
            <X v-else class="w-6 h-6 text-red-400" />
            <h3 :class="['text-xl font-bold', result.correct ? 'text-green-400' : 'text-red-400']">
              {{ result.correct ? 'Correct!' : 'Wrong!' }}
            </h3>
          </div>
          <p class="text-slate-300">
            The song was: <span class="font-bold text-white">{{ result.title }}</span> by <span class="font-bold text-white">{{ result.artist }}</span>
          </p>
        </div>
        
        <button
          @click="startNewRound"
          class="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw :size="20" /> Next Song
        </button>
      </div>
    </template>
    </div>
  </div>
</template>
