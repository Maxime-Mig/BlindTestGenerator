import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Play, Pause, Check, X, RefreshCw, Volume2 } from 'lucide-react'

const API_URL = 'http://localhost:8000/api/game'

export default function GameInterface() {
    const [loading, setLoading] = useState(false)
    const [currentSong, setCurrentSong] = useState(null)
    const [guess, setGuess] = useState('')
    const [result, setResult] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef(null)

    const startNewRound = async () => {
        setLoading(true)
        setResult(null)
        setGuess('')
        setIsPlaying(false)
        try {
            const res = await axios.get(`${API_URL}/start`)
            setCurrentSong(res.data)
            // Reset audio
            if (audioRef.current) {
                audioRef.current.src = `http://localhost:8000${res.data.clip_url}`
                audioRef.current.load()
            }
        } catch (err) {
            console.error("Error starting round:", err)
            alert("Failed to start round. Make sure backend is running and music is scanned.")
        } finally {
            setLoading(false)
        }
    }

    const handlePlayToggle = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!guess.trim() || !currentSong) return

        try {
            const res = await axios.post(`${API_URL}/guess/${currentSong.song_id}?guess=${encodeURIComponent(guess)}`)
            setResult(res.data)
            setIsPlaying(false) // Stop music on reveal
            if (audioRef.current) audioRef.current.pause()
        } catch (err) {
            console.error("Error submitting guess:", err)
        }
    }

    useEffect(() => {
        startNewRound()
    }, [])

    // Handle audio ended
    useEffect(() => {
        const audio = audioRef.current
        const handleEnded = () => setIsPlaying(false)
        if (audio) {
            audio.addEventListener('ended', handleEnded)
            return () => audio.removeEventListener('ended', handleEnded)
        }
    }, [audioRef.current])

    if (loading && !currentSong) {
        return <div className="text-center py-10 text-slate-300">Loading next song...</div>
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Audio Player Section */}
            <div className="flex flex-col items-center justify-center bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg animate-pulse-slow">
                    <Volume2 className="w-10 h-10 text-white" />
                </div>

                <audio ref={audioRef} className="hidden" />

                <button
                    onClick={handlePlayToggle}
                    className="flex items-center gap-2 px-6 py-2 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors"
                >
                    {isPlaying ? <><Pause size={20} /> Pause</> : <><Play size={20} /> Play Clip</>}
                </button>
            </div>

            {/* Guess Section */}
            {!result ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-400">What's this song?</label>
                        <input
                            type="text"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            placeholder="Enter title or artist..."
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-white placeholder-slate-500"
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!guess.trim()}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Guess
                    </button>
                </form>
            ) : (
                <div className="animate-fade-in">
                    <div className={`p-4 rounded-lg border mb-6 ${result.correct ? 'bg-green-900/30 border-green-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                        <div className="flex items-center gap-3 mb-2">
                            {result.correct ? (
                                <Check className="w-6 h-6 text-green-400" />
                            ) : (
                                <X className="w-6 h-6 text-red-400" />
                            )}
                            <h3 className={`text-xl font-bold ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
                                {result.correct ? 'Correct!' : 'Wrong!'}
                            </h3>
                        </div>
                        <p className="text-slate-300">
                            The song was: <span className="font-bold text-white">{result.title}</span> by <span className="font-bold text-white">{result.artist}</span>
                        </p>
                    </div>

                    <button
                        onClick={startNewRound}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={20} /> Next Song
                    </button>
                </div>
            )}
        </div>
    )
}
