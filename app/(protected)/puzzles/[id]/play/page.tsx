'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import AdminLayout from '@/app/components/AdminLayout'
import { useParams } from 'next/navigation'

type Cell = {
    letter: string | null
    number?: number
    isBlack: boolean
}

type Word = {
    word: string
    display_word: string
    clue: string
    number: number
    row: number
    col: number
    dir: 'H' | 'V'
    orientation: string
    length: number
}

export default function PlayPuzzlePage() {
    const params = useParams()
    const puzzleId = params.id

    const [puzzle, setPuzzle] = useState<any>(null)
    const [grid, setGrid] = useState<Cell[][]>([])
    const [userGrid, setUserGrid] = useState<string[][]>([])
    const [words, setWords] = useState<Word[]>([])
    const [selectedWord, setSelectedWord] = useState<Word | null>(null)
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAllClues, setShowAllClues] = useState(false)

    useEffect(() => {
        fetchPuzzle()
    }, [puzzleId])

    async function fetchPuzzle() {
        const { data, error } = await supabase
            .from('GeneratedPuzzle')
            .select(`
        *,
        Theme(name),
        Language(name),
        PuzzleConfig(
          name,
          grid_size,
          Difficulty(name)
        )
      `)
            .eq('id', puzzleId)
            .single()

        if (error || !data) {
            console.error('Error fetching puzzle:', error)
            return
        }

        setPuzzle(data)

        const gridData = JSON.parse(data.grid_JSON)
        const wordsData: Word[] = JSON.parse(data.words_JSON)

        const size = data.PuzzleConfig.grid_size
        const gridWithNumbers: Cell[][] = Array(size).fill(null).map(() =>
            Array(size).fill(null).map(() => ({ letter: null, isBlack: true }))
        )

        gridData.forEach((row: any, r: number) => {
            row.List.forEach((cell: string | null, c: number) => {
                if (cell !== null) {
                    gridWithNumbers[r][c] = {
                        letter: cell,
                        isBlack: false
                    }
                }
            })
        })

        wordsData.forEach(word => {
            if (gridWithNumbers[word.row] && gridWithNumbers[word.row][word.col]) {
                gridWithNumbers[word.row][word.col].number = word.number
            }
        })

        setGrid(gridWithNumbers)
        setWords(wordsData.sort((a, b) => a.number - b.number))
        setUserGrid(Array(size).fill(null).map(() => Array(size).fill('')))

        setLoading(false)
    }

    function handleCellClick(row: number, col: number) {
        if (grid[row][col].isBlack) return

        setSelectedCell({ row, col })

        const wordsAtCell = words.filter(w => {
            if (w.dir === 'H') {
                return w.row === row && col >= w.col && col < w.col + w.length
            } else {
                return w.col === col && row >= w.row && row < w.row + w.length
            }
        })

        if (wordsAtCell.length > 0) {
            if (selectedWord && wordsAtCell.includes(selectedWord) && wordsAtCell.length > 1) {
                const currentIndex = wordsAtCell.indexOf(selectedWord)
                setSelectedWord(wordsAtCell[(currentIndex + 1) % wordsAtCell.length])
            } else {
                setSelectedWord(wordsAtCell[0])
            }
        }
    }

    function handleKeyPress(e: React.KeyboardEvent) {
        if (!selectedCell) return

        const { row, col } = selectedCell

        if (e.key === 'Backspace') {
            const newGrid = [...userGrid]
            newGrid[row][col] = ''
            setUserGrid(newGrid)
            moveToPreviousCell(row, col)
        } else if (e.key === 'Delete') {
            const newGrid = [...userGrid]
            newGrid[row][col] = ''
            setUserGrid(newGrid)
        } else if (e.key === 'ArrowLeft') {
            moveTo(row, col - 1)
        } else if (e.key === 'ArrowRight') {
            moveTo(row, col + 1)
        } else if (e.key === 'ArrowUp') {
            moveTo(row - 1, col)
        } else if (e.key === 'ArrowDown') {
            moveTo(row + 1, col)
        } else if (/^[a-zA-Z]$/.test(e.key)) {
            const newGrid = [...userGrid]
            newGrid[row][col] = e.key.toUpperCase()
            setUserGrid(newGrid)
            moveToNextCell(row, col)
        }
    }

    function moveTo(row: number, col: number) {
        if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length && !grid[row][col].isBlack) {
            handleCellClick(row, col)
        }
    }

    function moveToNextCell(row: number, col: number) {
        if (!selectedWord) return

        if (selectedWord.dir === 'H') {
            if (col + 1 < selectedWord.col + selectedWord.length) {
                moveTo(row, col + 1)
            }
        } else {
            if (row + 1 < selectedWord.row + selectedWord.length) {
                moveTo(row + 1, col)
            }
        }
    }

    function moveToPreviousCell(row: number, col: number) {
        if (!selectedWord) return

        if (selectedWord.dir === 'H') {
            if (col > selectedWord.col) {
                moveTo(row, col - 1)
            }
        } else {
            if (row > selectedWord.row) {
                moveTo(row - 1, col)
            }
        }
    }

    function isCellInSelectedWord(row: number, col: number): boolean {
        if (!selectedWord) return false

        if (selectedWord.dir === 'H') {
            return selectedWord.row === row && col >= selectedWord.col && col < selectedWord.col + selectedWord.length
        } else {
            return selectedWord.col === col && row >= selectedWord.row && row < selectedWord.row + selectedWord.length
        }
    }

    function checkAnswers() {
        let correct = 0
        let total = 0

        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (!grid[r][c].isBlack) {
                    total++
                    if (userGrid[r][c] === grid[r][c].letter) {
                        correct++
                    }
                }
            }
        }

        alert(`Score: ${correct}/${total} correct (${((correct / total) * 100).toFixed(1)}%)`)
    }

    function revealAnswer() {
        if (!selectedWord) return

        const newGrid = [...userGrid]
        for (let i = 0; i < selectedWord.length; i++) {
            if (selectedWord.dir === 'H') {
                newGrid[selectedWord.row][selectedWord.col + i] = grid[selectedWord.row][selectedWord.col + i].letter!
            } else {
                newGrid[selectedWord.row + i][selectedWord.col] = grid[selectedWord.row + i][selectedWord.col].letter!
            }
        }
        setUserGrid(newGrid)
    }

    if (loading) {
        return (
            <AdminLayout title="Play Puzzle">
                <div className="text-gray-400">Loading puzzle...</div>
            </AdminLayout>
        )
    }

    if (!puzzle) {
        return (
            <AdminLayout title="Play Puzzle">
                <div className="text-red-400">Puzzle not found</div>
            </AdminLayout>
        )
    }

    const acrossWords = words.filter(w => w.dir === 'H')
    const downWords = words.filter(w => w.dir === 'V')

    // Calculate responsive cell size based on grid size
    const gridSize = puzzle.PuzzleConfig.grid_size

    let cellClass = 'w-12 h-12' // Default for desktop
    let textClass = 'text-2xl'
    let numberClass = 'text-xs'

    if (gridSize > 17) {
        cellClass = 'w-8 h-8 sm:w-10 sm:h-10'
        textClass = 'text-lg sm:text-xl'
        numberClass = 'text-[8px] sm:text-[10px]'
    } else if (gridSize > 13) {
        cellClass = 'w-10 h-10 sm:w-12 sm:h-12'
        textClass = 'text-xl sm:text-2xl'
        numberClass = 'text-[9px] sm:text-xs'
    } else {
        cellClass = 'w-12 h-12 sm:w-14 sm:h-14'
        textClass = 'text-2xl sm:text-3xl'
        numberClass = 'text-xs sm:text-sm'
    }

    return (
        <AdminLayout title="Play Puzzle">
            <div className="max-w-7xl mx-auto px-2 sm:px-4">
                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{puzzle.PuzzleConfig.name}</h1>
                    <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                        <span>🎨 {puzzle.Theme.name}</span>
                        <span>🌍 {puzzle.Language.name}</span>
                        <span>⚡ {puzzle.PuzzleConfig.Difficulty.name}</span>
                        <span>📏 {puzzle.PuzzleConfig.grid_size}×{puzzle.PuzzleConfig.grid_size}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Grid */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 p-2 sm:p-6 rounded-lg border border-gray-700">
                            {/* Grid Container */}
                            <div className="overflow-x-auto">
                                <div
                                    className="inline-block mx-auto"
                                    onKeyDown={handleKeyPress}
                                    tabIndex={0}
                                >
                                    <div className="grid gap-0 border-2 border-gray-600">
                                        {grid.map((row, r) => (
                                            <div key={r} className="flex">
                                                {row.map((cell, c) => (
                                                    <div
                                                        key={`${r}-${c}`}
                                                        onClick={() => handleCellClick(r, c)}
                                                        className={`
  ${cellClass}
  border border-gray-600 relative cursor-pointer select-none
                              ${cell.isBlack ? 'bg-black' : 'bg-white'}
                              ${selectedCell?.row === r && selectedCell?.col === c ? 'ring-2 ring-blue-500 z-10' : ''}
                              ${isCellInSelectedWord(r, c) && !(selectedCell?.row === r && selectedCell?.col === c) ? 'bg-blue-100' : ''}
                            `}
                                                    >
                                                        {!cell.isBlack && (
                                                            <>
                                                                {cell.number && (
                                                                    <span className="absolute top-0 left-0.5 ${numberClass} text-gray-600 font-bold leading-none">
                                                                        {cell.number}
                                                                    </span>
                                                                )}
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <span className={`
                                                                    ${textClass} 
                                                                    font-bold text-gray-900
                                                                    `}>
                                                                        {userGrid[r][c]}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                                <button
                                    onClick={checkAnswers}
                                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm sm:text-base"
                                >
                                    ✓ Check
                                </button>
                                <button
                                    onClick={revealAnswer}
                                    disabled={!selectedWord}
                                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm sm:text-base"
                                >
                                    💡 Reveal
                                </button>
                                <button
                                    onClick={() => setShowAllClues(!showAllClues)}
                                    className="flex-1 sm:flex-none lg:hidden px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base"
                                >
                                    📋 All Clues
                                </button>
                            </div>
                        </div>

                        {/* Current Clue - Mobile/Tablet */}
                        {selectedWord && (
                            <div className="lg:hidden mt-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 bg-blue-600 text-white px-3 py-1 rounded font-bold">
                                        {selectedWord.number}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-400 mb-1">
                                            {selectedWord.orientation}
                                        </div>
                                        <div className="text-white">
                                            {selectedWord.clue}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clues - Desktop */}
                    <div className="hidden lg:block space-y-4">
                        {/* Across */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 max-h-96 overflow-y-auto">
                            <h3 className="text-lg font-bold text-white mb-3">Across</h3>
                            <div className="space-y-2">
                                {acrossWords.map(word => (
                                    <div
                                        key={`across-${word.number}`}
                                        onClick={() => setSelectedWord(word)}
                                        className={`
                      p-2 rounded cursor-pointer transition-colors
                      ${selectedWord === word ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}
                    `}
                                    >
                                        <span className="font-bold">{word.number}.</span> {word.clue}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Down */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 max-h-96 overflow-y-auto">
                            <h3 className="text-lg font-bold text-white mb-3">Down</h3>
                            <div className="space-y-2">
                                {downWords.map(word => (
                                    <div
                                        key={`down-${word.number}`}
                                        onClick={() => setSelectedWord(word)}
                                        className={`
                      p-2 rounded cursor-pointer transition-colors
                      ${selectedWord === word ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}
                    `}
                                    >
                                        <span className="font-bold">{word.number}.</span> {word.clue}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* All Clues Modal - Mobile/Tablet */}
                {showAllClues && (
                    <div className="lg:hidden fixed inset-0 bg-black bg-opacity-75 z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-gray-800 rounded-t-lg sm:rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-4 border-b border-gray-700">
                                <h2 className="text-xl font-bold text-white">All Clues</h2>
                                <button
                                    onClick={() => setShowAllClues(false)}
                                    className="text-gray-400 hover:text-white text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="overflow-y-auto p-4 space-y-6">
                                {/* Across */}
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3">Across</h3>
                                    <div className="space-y-2">
                                        {acrossWords.map(word => (
                                            <div
                                                key={`modal-across-${word.number}`}
                                                onClick={() => {
                                                    setSelectedWord(word)
                                                    setShowAllClues(false)
                                                    // Focus on the first cell of this word
                                                    handleCellClick(word.row, word.col)
                                                }}
                                                className={`
                          p-3 rounded cursor-pointer transition-colors
                          ${selectedWord === word ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}
                        `}
                                            >
                                                <span className="font-bold">{word.number}.</span> {word.clue}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Down */}
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3">Down</h3>
                                    <div className="space-y-2">
                                        {downWords.map(word => (
                                            <div
                                                key={`modal-down-${word.number}`}
                                                onClick={() => {
                                                    setSelectedWord(word)
                                                    setShowAllClues(false)
                                                    handleCellClick(word.row, word.col)
                                                }}
                                                className={`
                          p-3 rounded cursor-pointer transition-colors
                          ${selectedWord === word ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}
                        `}
                                            >
                                                <span className="font-bold">{word.number}.</span> {word.clue}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
