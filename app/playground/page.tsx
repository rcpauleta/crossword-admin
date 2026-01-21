'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PublicLayout from '../components/PublicLayout'
import { useLanguage } from '../contexts/LanguageContext'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'

export default function PlaygroundPage() {
    const { user } = useAuth()
    const [gridSize, setGridSize] = useState(15)
    const [wordCount, setWordCount] = useState(20)
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
    const [generating, setGenerating] = useState(false)
    const { selectedLanguage } = useLanguage()
    const router = useRouter()

    async function generateCustomPuzzle() {
        setGenerating(true)

        try {
            const response = await fetch('/api/generate-puzzle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    languageId: selectedLanguage,
                    gridSize,
                    maxWords: wordCount,
                    difficulty,
                    isPlayground: true,  
                    userId: user?.id || null
                })
            })

            const result = await response.json()

            if (result.success) {
                router.push(`/puzzles/${result.puzzle.id}`)
            } else {
                alert('Erro ao gerar puzzle: ' + result.error)
            }
        } catch (error) {
            console.error('Error generating puzzle:', error)
            alert('Erro ao gerar puzzle')
        } finally {
            setGenerating(false)
        }
    }

    return (
        <PublicLayout>
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-5xl font-bold text-white mb-4">
                            🎮 Playground
                        </h1>
                        <p className="text-xl text-gray-300">
                            Cria o teu puzzle personalizado
                        </p>
                    </div>
                    <div className="text-center mt-6">
                        <Link
                            href="/playground/my-puzzles"
                            className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                            📚 Ver Os Meus Puzzles →
                        </Link>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-8 space-y-8">
                        {/* Grid Size */}
                        <div>
                            <label className="block text-white font-bold mb-3">
                                Tamanho do Grid: {gridSize}×{gridSize}
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="25"
                                step="5"
                                value={gridSize}
                                onChange={(e) => setGridSize(parseInt(e.target.value))}
                                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-sm text-gray-400 mt-2">
                                <span>Pequeno (10×10)</span>
                                <span>Médio (15×15)</span>
                                <span>Grande (20×20)</span>
                                <span>XL (25×25)</span>
                            </div>
                        </div>

                        {/* Word Count */}
                        <div>
                            <label className="block text-white font-bold mb-3">
                                Número de Palavras: {wordCount}
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="50"
                                step="5"
                                value={wordCount}
                                onChange={(e) => setWordCount(parseInt(e.target.value))}
                                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-sm text-gray-400 mt-2">
                                <span>Rápido (10)</span>
                                <span>Normal (25)</span>
                                <span>Desafio (50)</span>
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div>
                            <label className="block text-white font-bold mb-3">
                                Dificuldade
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => setDifficulty('easy')}
                                    className={`p-4 rounded-lg font-medium transition-all ${difficulty === 'easy'
                                        ? 'bg-green-600 text-white scale-105'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    😊 Fácil
                                </button>
                                <button
                                    onClick={() => setDifficulty('medium')}
                                    className={`p-4 rounded-lg font-medium transition-all ${difficulty === 'medium'
                                        ? 'bg-yellow-600 text-white scale-105'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    😐 Médio
                                </button>
                                <button
                                    onClick={() => setDifficulty('hard')}
                                    className={`p-4 rounded-lg font-medium transition-all ${difficulty === 'hard'
                                        ? 'bg-red-600 text-white scale-105'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    😤 Difícil
                                </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generateCustomPuzzle}
                            disabled={generating}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-5 rounded-lg text-xl transition-all shadow-lg hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            {generating ? 'A Gerar Puzzle...' : '🎯 Gerar & Jogar'}
                        </button>
                    </div>

                    {/* Info Box */}
                    <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                        <h3 className="text-white font-bold mb-2">💡 Dica</h3>
                        <p className="text-gray-300 text-sm">
                            Os puzzles gerados são únicos e ficam guardados para poderes jogar mais tarde.
                            Grids maiores e mais palavras = mais desafio!
                        </p>
                    </div>
                </div>
            </div>
        </PublicLayout>
    )
}
