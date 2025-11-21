<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { Music, Gamepad2, Film, Tv, HelpCircle, CheckSquare, Square, RefreshCw } from 'lucide-vue-next'

const API_URL = 'http://localhost:8000/api/game'
const router = useRouter()

const availableTypes = ref<string[]>([])

const availableDifficulties = ref<string[]>([])
const selectedTypes = ref<string[]>([])
const selectedDifficulties = ref<string[]>([])
const loading = ref(true)
const error = ref('')

const fetchFilters = async () => {
  try {
    const res = await axios.get(`${API_URL}/filters`)
    availableTypes.value = res.data.types
    availableDifficulties.value = res.data.difficulties
    
    // Select all by default if available, or let user choose
    // selectedTypes.value = [...availableTypes.value]
    // selectedDifficulties.value = [...availableDifficulties.value]
  } catch (err) {
    console.error("Error fetching filters:", err)
    error.value = "Failed to load game options. Is the backend running?"
    // Fallback for demo/dev if backend fails
    availableTypes.value = ['Anime', 'Game', 'Movie', 'Series']
    availableDifficulties.value = ['Easy', 'Normal', 'Hard']
  } finally {
    loading.value = false
  }
}

const toggleType = (type: string) => {
  if (selectedTypes.value.includes(type)) {
    selectedTypes.value = selectedTypes.value.filter(t => t !== type)
  } else {
    selectedTypes.value.push(type)
  }
}

const toggleDifficulty = (diff: string) => {
  if (selectedDifficulties.value.includes(diff)) {
    selectedDifficulties.value = selectedDifficulties.value.filter(d => d !== diff)
  } else {
    selectedDifficulties.value.push(diff)
  }
}

const startGame = () => {
  const filters = {
    types: selectedTypes.value,
    difficulties: selectedDifficulties.value
  }
  router.push({
    name: 'game',
    query: {
      filters: JSON.stringify(filters)
    }
  })
}

const scanning = ref(false)
const scanMessage = ref('')

const scanLibrary = async () => {
  scanning.value = true
  scanMessage.value = ''
  try {
    const res = await axios.post(`${API_URL}/scan`)
    if (res.data.added > 0) {
      scanMessage.value = `Successfully added ${res.data.added} songs!`
      await fetchFilters()
    } else {
      scanMessage.value = "No new songs found. Make sure you added MP3 files to the 'music' folder."
    }
  } catch (err) {
    console.error("Error scanning library:", err)
    scanMessage.value = "Failed to scan library."
  } finally {
    scanning.value = false
  }
}

// Helper to get icon for type
const getTypeIcon = (type: string) => {
  const lower = type.toLowerCase()
  if (lower.includes('anime')) return Tv
  if (lower.includes('game')) return Gamepad2
  if (lower.includes('movie') || lower.includes('film')) return Film
  if (lower.includes('serie')) return Tv
  return Music
}

onMounted(() => {
  fetchFilters()
})
</script>

<template>
  <div class="w-full max-w-4xl bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden p-8">
    <h2 class="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
      Configure Your Game
    </h2>

    <div v-if="loading" class="text-center py-12 text-slate-400">
      <div class="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      Loading options...
    </div>

    <div v-else-if="error || availableTypes.length === 0" class="text-center py-12">
      <div class="text-red-400 mb-4" v-if="error">{{ error }}</div>
      <div class="text-slate-300 mb-6" v-else>
        No songs found in the library. Please add music files to the <code>music</code> folder.
      </div>
      
      <button 
        @click="scanLibrary" 
        :disabled="scanning"
        class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
      >
        <RefreshCw :class="['w-5 h-5', scanning ? 'animate-spin' : '']" />
        {{ scanning ? 'Scanning...' : 'Scan Library' }}
      </button>
      
      <p v-if="scanMessage" :class="['mt-4 text-sm', scanMessage.includes('Success') ? 'text-green-400' : 'text-amber-400']">
        {{ scanMessage }}
      </p>
    </div>

    <div v-else class="space-y-8">
      <!-- Types Selection -->
      <section>
        <h3 class="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Music class="w-5 h-5 text-purple-400" /> Select Categories
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            v-for="type in availableTypes"
            :key="type"
            @click="toggleType(type)"
            :class="[
              'flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200',
              selectedTypes.includes(type)
                ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
            ]"
          >
            <component :is="getTypeIcon(type)" class="w-8 h-8 mb-2" />
            <span class="font-medium">{{ type }}</span>
            <div class="absolute top-2 right-2">
              <CheckSquare v-if="selectedTypes.includes(type)" class="w-4 h-4 text-purple-400" />
              <Square v-else class="w-4 h-4 text-slate-600" />
            </div>
          </button>
        </div>
        <p v-if="selectedTypes.length === 0" class="text-sm text-amber-400 mt-2">
          * Select at least one category (or leave empty for all)
        </p>
      </section>

      <!-- Difficulty Selection -->
      <section>
        <h3 class="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <HelpCircle class="w-5 h-5 text-pink-400" /> Select Difficulty
        </h3>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="diff in availableDifficulties"
            :key="diff"
            @click="toggleDifficulty(diff)"
            :class="[
              'px-6 py-2 rounded-full border font-medium transition-all duration-200 flex items-center gap-2',
              selectedDifficulties.includes(diff)
                ? 'bg-pink-600/20 border-pink-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'
            ]"
          >
            {{ diff }}
            <CheckSquare v-if="selectedDifficulties.includes(diff)" class="w-4 h-4" />
          </button>
        </div>
      </section>

      <!-- Start Button -->
      <div class="pt-8 flex justify-center">
        <button
          @click="startGame"
          class="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-lg font-bold rounded-full transition-all transform hover:scale-105 shadow-xl flex items-center gap-3"
        >
          <Gamepad2 class="w-6 h-6" />
          Start Game
        </button>
      </div>
    </div>
  </div>
</template>
