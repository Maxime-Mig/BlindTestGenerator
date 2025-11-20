import { useState } from 'react'
import GameInterface from './components/GameInterface'
import { Music } from 'lucide-react'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Music className="w-10 h-10 text-purple-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Blind Test Generator
          </h1>
        </div>
        <p className="text-slate-400">Test your musical knowledge!</p>
      </header>

      <main className="w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden p-6">
        {!gameStarted ? (
          <div className="text-center py-10">
            <h2 className="text-2xl font-semibold mb-6">Ready to play?</h2>
            <button
              onClick={() => setGameStarted(true)}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              Start Game
            </button>
          </div>
        ) : (
          <GameInterface />
        )}
      </main>

      <footer className="mt-12 text-slate-500 text-sm">
        Powered by Python & React
      </footer>
    </div>
  )
}

export default App
