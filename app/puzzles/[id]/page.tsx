'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import { useParams } from 'next/navigation'
import PublicLayout from '@/app/components/PublicLayout'
import { useAuth } from '@/app/contexts/AuthContext'

type Cell = {
    letter: string | null
    number?: number
    isBlack: boolean
    userAnswer?: string
}

type Word = {
    word: string
    display_word: string
    clue: string
    number: number
    row: number
    col: number
    dir: string
    length: number
}

export default function PlayPuzzlePage() {
    const params = useParams()
    const { user } = useAuth()

    const HINT_TIME_PENALTY = 30 // seconds per hint
    const REVEAL_LETTER_PENALTY = 10 // seconds per letter
    const REVEAL_WORD_PENALTY = 60 // seconds per word

    // State
    const [puzzle, setPuzzle] = useState<any>(null)
    const [grid, setGrid] = useState<Cell[][]>([])
    const [words, setWords] = useState<Word[]>([])
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
    const [selectedWord, setSelectedWord] = useState<Word | null>(null)
    const [direction, setDirection] = useState<'H' | 'V'>('H')
    const [score, setScore] = useState(0)
    const [showAllClues, setShowAllClues] = useState(false)
    const [sessionId, setSessionId] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [showCompletionModal, setShowCompletionModal] = useState(false)
    const [completionStats, setCompletionStats] = useState<{
        time: number
        score: number
        hintsUsed: number
        penalty: number
    } | null>(null)

    // State
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showCorrectImmediately, setShowCorrectImmediately] = useState(false)
    const [hintsUsed, setHintsUsed] = useState(0)
    const [timePenalty, setTimePenalty] = useState(0) // Total penalty seconds

    // Refs
    const startTimeRef = useRef<number>(Date.now())
    const sessionStartTimeRef = useRef<number>(Date.now()) // When they opened the page this time
    const accumulatedTimeRef = useRef<number>(0) // Previously saved time from database
    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
    const isClueClickRef = useRef(false)

    // Separate state to track if we've loaded the session
    const [sessionLoaded, setSessionLoaded] = useState(false)

    useEffect(() => {
        fetchPuzzle()
    }, [params.id])

    // NEW: Load session when user becomes available
    useEffect(() => {
        if (user && puzzle && grid.length > 0 && !sessionLoaded) {
            console.log('User is now available, loading session...')
            loadOrCreateSession(puzzle.id, grid)
            setSessionLoaded(true)
        }
    }, [user, puzzle, grid, sessionLoaded])

    // Focus selected cell when it changes
    useEffect(() => {
        if (selectedCell) {
            const key = `${selectedCell.row}-${selectedCell.col}`
            inputRefs.current[key]?.focus()
        }
    }, [selectedCell])

    // Timer effect - only runs when page is active
    useEffect(() => {
        if (!isTimerRunning) return

        const interval = setInterval(() => {
            // Calculate time spent in THIS session + previously accumulated time
            const currentSessionTime = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
            const totalTime = accumulatedTimeRef.current + currentSessionTime
            setElapsedSeconds(totalTime)
        }, 1000)

        return () => clearInterval(interval)
    }, [isTimerRunning])

    // Pause timer when tab is hidden, resume when visible
    useEffect(() => {
        function handleVisibilityChange() {
            if (document.hidden) {
                // Tab hidden - save current time and pause
                if (isTimerRunning) {
                    const currentSessionTime = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
                    const totalTime = accumulatedTimeRef.current + currentSessionTime

                    // Save to database
                    if (user && sessionId) {
                        supabase
                            .from('GameSession')
                            .update({ time_seconds: totalTime })
                            .eq('id', sessionId)
                    }

                    // Update accumulated time
                    accumulatedTimeRef.current = totalTime
                }
            } else {
                // Tab visible again - restart session timer
                if (isTimerRunning) {
                    sessionStartTimeRef.current = Date.now()
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [isTimerRunning, user, sessionId])

    // Save time when leaving the page
    useEffect(() => {
        function handleBeforeUnload() {
            if (isTimerRunning && user && sessionId) {
                const currentSessionTime = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
                const totalTime = accumulatedTimeRef.current + currentSessionTime

                // Use sendBeacon for reliable saving on page unload
                const data = new Blob([JSON.stringify({
                    time_seconds: totalTime,
                    grid_state: grid
                })], { type: 'application/json' })

                navigator.sendBeacon(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/GameSession?id=eq.${sessionId}`,
                    data
                )
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isTimerRunning, user, sessionId, grid])

    // Auto-save progress every 30 seconds
    useEffect(() => {
        if (!user || !sessionId || !isTimerRunning || grid.length === 0) return

        const interval = setInterval(() => {
            saveProgress()
        }, 30000) // 30 seconds

        return () => clearInterval(interval)
    }, [user, sessionId, isTimerRunning, grid])

    // Load user preferences from localStorage
    useEffect(() => {
        const savedPref = localStorage.getItem('crossword_show_correct')
        if (savedPref !== null) {
            setShowCorrectImmediately(savedPref === 'true')
        }
    }, [])

    // Save preference when changed
    function toggleShowCorrect(value: boolean) {
        setShowCorrectImmediately(value)
        localStorage.setItem('crossword_show_correct', String(value))
    }

    function calculateProgress() {
        let filled = 0
        let total = 0

        grid.forEach(row => {
            row.forEach(cell => {
                if (!cell.isBlack) {
                    total++
                    if (cell.userAnswer) filled++
                }
            })
        })

        return { filled, total, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 }
    }

    const progress = calculateProgress()

    async function fetchPuzzle() {
        console.log('=== FETCH PUZZLE STARTED ===')

        try {
            const { data, error } = await supabase
                .from('GeneratedPuzzle')
                .select(`
                id,
                created_at,
                grid_JSON,
                words_JSON,
                puzzle_config_id,
                PuzzleConfig:puzzle_config_id (
                    id,
                    name,
                    grid_size,
                    language_id
                )
            `)
                .eq('id', params.id)
                .single()

            if (error) {
                console.error('Error fetching puzzle:', error)
                alert('Failed to load puzzle')
                return
            }

            if (!data) {
                alert('Puzzle not found')
                return
            }

            if (!data.PuzzleConfig) {
                const { data: configData } = await supabase
                    .from('PuzzleConfig')
                    .select('*')
                    .eq('id', data.puzzle_config_id)
                    .single()

                data.PuzzleConfig = configData
            }

            if (!data.grid_JSON || !data.words_JSON) {
                console.error('Missing grid or words')
                alert('Puzzle data is incomplete')
                return
            }

            setPuzzle(data)

            const parsedGrid = JSON.parse(data.grid_JSON)
            const parsedWords = JSON.parse(data.words_JSON)

            const gridWithAnswers = parsedGrid.map((row: any) =>
                row.List.map((cell: any) => ({
                    letter: cell,
                    isBlack: cell === null,
                    userAnswer: '',
                    number: undefined
                }))
            )

            parsedWords.forEach((word: Word) => {
                gridWithAnswers[word.row][word.col].number = word.number
            })

            setWords(parsedWords)
            setGrid(gridWithAnswers) // Set initial empty grid

            // Session will be loaded by the useEffect when user is available

            startTimeRef.current = Date.now()

        } catch (error) {
            console.error('Error loading puzzle:', error)
            alert('Failed to load puzzle: ' + String(error))
        }
    }

    async function loadOrCreateSession(puzzleId: number, currentGrid: Cell[][]) {
        if (!user) {
            console.log('loadOrCreateSession called but no user')
            return
        }

        console.log('Loading session for puzzle:', puzzleId)

        const { data: existingSession } = await supabase
            .from('GameSession')
            .select('*')
            .eq('user_id', user.id)
            .eq('puzzle_id', puzzleId)
            .single()

        console.log('Session data:', existingSession)

        if (existingSession) {
            setSessionId(existingSession.id)

            // Check if already completed
            if (existingSession.is_completed) {
                // Show final time, don't start timer
                setElapsedSeconds(existingSession.time_seconds || 0)
                accumulatedTimeRef.current = existingSession.time_seconds || 0
                setIsTimerRunning(false)
            } else {
                // Load previously accumulated time
                accumulatedTimeRef.current = existingSession.time_seconds || 0
                setElapsedSeconds(existingSession.time_seconds || 0)

                // Start timer for this page session
                sessionStartTimeRef.current = Date.now()
                setIsTimerRunning(true)
            }

            // Restore grid state if available
            if (existingSession.grid_state && Array.isArray(existingSession.grid_state)) {
                console.log('Restoring saved progress...')

                const restoredGrid = currentGrid.map((row, r) =>
                    row.map((cell, c) => {
                        const savedCell = existingSession.grid_state[r]?.[c]
                        return {
                            ...cell,
                            userAnswer: savedCell?.userAnswer || ''
                        }
                    })
                )

                setGrid(restoredGrid)

                if (existingSession.score_percentage > 0) {
                    setScore(existingSession.score_percentage)
                }
            }
        } else {
            // Create new session
            const totalCells = currentGrid.flat().filter(c => !c.isBlack).length

            const { data: newSession } = await supabase
                .from('GameSession')
                .insert({
                    user_id: user.id,
                    puzzle_id: puzzleId,
                    total_cells: totalCells,
                    started_at: new Date().toISOString(),
                    time_seconds: 0
                })
                .select()
                .single()

            if (newSession) {
                setSessionId(newSession.id)
                console.log('New session created:', newSession.id)

                // Start timer for new session
                accumulatedTimeRef.current = 0
                sessionStartTimeRef.current = Date.now()
                setElapsedSeconds(0)
                setIsTimerRunning(true)
            }
        }
    }

    async function saveProgress() {
        if (!user || !sessionId || !isTimerRunning) return

        setIsSaving(true)
        console.log('Auto-saving progress...')

        // Calculate current total time
        const currentSessionTime = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
        const totalTime = accumulatedTimeRef.current + currentSessionTime

        await supabase
            .from('GameSession')
            .update({
                grid_state: grid,
                time_seconds: totalTime,
                hints_used: hintsUsed,
                time_penalty: timePenalty
            })
            .eq('id', sessionId)

        // Update accumulated time
        accumulatedTimeRef.current = totalTime
        sessionStartTimeRef.current = Date.now()

        setTimeout(() => setIsSaving(false), 1000)
    }

    async function checkSolution() {
        let correct = 0
        let total = 0

        grid.forEach((row) => {
            row.forEach((cell) => {
                if (!cell.isBlack) {
                    total++
                    if (cell.userAnswer?.toUpperCase() === cell.letter?.toUpperCase()) {
                        correct++
                    }
                }
            })
        })

        const scorePercentage = Math.round((correct / total) * 100)
        setScore(scorePercentage)

        // Calculate current total time (accumulated + current session)
        const currentSessionTime = isTimerRunning
            ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
            : 0
        const totalTime = accumulatedTimeRef.current + currentSessionTime
        const finalTime = totalTime + timePenalty

        // If logged in and 100% complete, mark as completed
        if (user && sessionId && scorePercentage === 100) {
            setIsTimerRunning(false) // Stop timer

            await supabase
                .from('GameSession')
                .update({
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                    correct_cells: correct,
                    total_cells: total,
                    score_percentage: scorePercentage,
                    time_seconds: finalTime,
                    hints_used: hintsUsed,
                    time_penalty: timePenalty,
                    grid_state: grid
                })
                .eq('id', sessionId)

            // Show completion modal instead of alert
            setCompletionStats({
                time: finalTime,
                score: scorePercentage,
                hintsUsed: hintsUsed,
                penalty: timePenalty
            })
            setShowCompletionModal(true)
        } else {
            // Not complete yet - show score
            alert(`Pontuação: ${correct}/${total} (${scorePercentage}%)`)

            // Save progress with current time
            if (user && sessionId) {
                await supabase
                    .from('GameSession')
                    .update({
                        correct_cells: correct,
                        score_percentage: scorePercentage,
                        time_seconds: finalTime,
                        hints_used: hintsUsed,
                        time_penalty: timePenalty,
                        grid_state: grid
                    })
                    .eq('id', sessionId)

                // Update refs
                accumulatedTimeRef.current = finalTime
                sessionStartTimeRef.current = Date.now()
            }
        }
    }

    function revealLetter() {
        if (!selectedCell) {
            alert('Selecione uma célula primeiro')
            return
        }

        const row = selectedCell.row
        const col = selectedCell.col
        const cell = grid[row][col]

        if (cell.isBlack) return
        if (cell.userAnswer === cell.letter) {
            alert('Esta letra já está correta!')
            return
        }

        // Add penalty
        setTimePenalty(prev => prev + REVEAL_LETTER_PENALTY)
        setHintsUsed(prev => prev + 1)

        // Reveal the letter
        const newGrid = [...grid]
        newGrid[row][col].userAnswer = cell.letter || ''
        setGrid(newGrid)

        // Move to next cell
        moveToNextCell(row, col)
    }

    function revealWord() {
        console.log('Reveal word called, selectedWord:', selectedWord)

        if (!selectedWord) {
            alert('Selecione uma palavra clicando numa célula ou pista')
            return
        }

        const confirmMsg = `Revelar palavra completa?\n\nPalavra: ${selectedWord.display_word}\nPista: ${selectedWord.clue}\n\n⏱️ Penalização: +${REVEAL_WORD_PENALTY} segundos`
        if (!confirm(confirmMsg)) return

        // Add penalty
        setTimePenalty(prev => prev + REVEAL_WORD_PENALTY)
        setHintsUsed(prev => prev + 1)

        const newGrid = [...grid]
        for (let i = 0; i < selectedWord.length; i++) {
            if (selectedWord.dir === 'H') {
                const col = selectedWord.col + i
                newGrid[selectedWord.row][col].userAnswer = newGrid[selectedWord.row][col].letter || ''
            } else {
                const row = selectedWord.row + i
                newGrid[row][selectedWord.col].userAnswer = newGrid[row][selectedWord.col].letter || ''
            }
        }
        setGrid(newGrid)
    }

    function revealAll() {
        const confirmMsg = 'Tem a certeza que quer revelar todas as respostas?\n\nIsto irá desqualificar o seu tempo do leaderboard.'
        if (!confirm(confirmMsg)) return

        const newGrid = grid.map(row =>
            row.map(cell => ({
                ...cell,
                userAnswer: cell.isBlack ? '' : cell.letter || ''
            }))
        )
        setGrid(newGrid)
        setIsTimerRunning(false) // Stop timer - they gave up
    }

    function clearAll() {
        const newGrid = grid.map(row =>
            row.map(cell => ({
                ...cell,
                userAnswer: ''
            }))
        )
        setGrid(newGrid)
        setScore(0)
    }

    function handleCellClick(row: number, col: number) {
        if (grid[row][col].isBlack) return

        // If this was triggered by a clue click, don't override
        if (isClueClickRef.current) {
            console.log('Cell click ignored - came from clue click')
            return
        }

        console.log('Cell clicked:', row, col)

        // Check what words exist at this position
        const horizontalWord = findWordAtPosition(row, col, 'H')
        const verticalWord = findWordAtPosition(row, col, 'V')

        console.log('Words at position:', { horizontalWord: horizontalWord?.word, verticalWord: verticalWord?.word })

        // If clicking same cell, toggle direction (if both words exist)
        if (selectedCell?.row === row && selectedCell?.col === col) {
            if (horizontalWord && verticalWord) {
                // Both words exist, toggle
                const newDir = direction === 'H' ? 'V' : 'H'
                setDirection(newDir)
                const word = newDir === 'H' ? horizontalWord : verticalWord
                setSelectedWord(word)
                console.log('Same cell - toggled to:', newDir, word?.word)
            }
            // If only one word exists, do nothing (already selected)
        } else {
            // New cell clicked
            setSelectedCell({ row, col })

            // Smart direction selection:
            if (horizontalWord && verticalWord) {
                // Both exist - default to horizontal
                setDirection('H')
                setSelectedWord(horizontalWord)
                console.log('Both words exist - defaulting to H:', horizontalWord.word)
            } else if (horizontalWord) {
                // Only horizontal exists
                setDirection('H')
                setSelectedWord(horizontalWord)
                console.log('Only H word exists:', horizontalWord.word)
            } else if (verticalWord) {
                // Only vertical exists
                setDirection('V')
                setSelectedWord(verticalWord)
                console.log('Only V word exists:', verticalWord.word)
            } else {
                // No word found (shouldn't happen)
                setSelectedWord(null)
                console.log('No word found at position')
            }
        }
    }

    function handleClueClick(word: Word) {
        console.log('Clue clicked:', word.number, word.dir, word.clue)

        // Prevent cell click from overriding our selection
        isClueClickRef.current = true

        const newDir = word.dir as 'H' | 'V'

        setDirection(newDir)
        setSelectedWord(word)
        setSelectedCell({ row: word.row, col: word.col })

        console.log('Selected word set to:', word)

        const key = `${word.row}-${word.col}`
        setTimeout(() => {
            inputRefs.current[key]?.focus()
            // Reset the flag after everything settles
            setTimeout(() => {
                isClueClickRef.current = false
            }, 50)
        }, 0)
    }

    function findWordAtPosition(row: number, col: number, dir: 'H' | 'V'): Word | null {
        return words.find(w => {
            if (w.dir !== dir) return false
            if (dir === 'H') {
                return w.row === row && col >= w.col && col < w.col + w.length
            } else {
                return w.col === col && row >= w.row && row < w.row + w.length
            }
        }) || null
    }

    function isCellInSelectedWord(row: number, col: number): boolean {
        if (!selectedWord) return false
        if (selectedWord.dir === 'H') {
            return selectedWord.row === row && col >= selectedWord.col && col < selectedWord.col + selectedWord.length
        } else {
            return selectedWord.col === col && row >= selectedWord.row && row < selectedWord.row + selectedWord.length
        }
    }
    function handleKeyDown(e: React.KeyboardEvent, row: number, col: number) {
        if (grid[row][col].isBlack) return

        if (e.key.match(/^[a-zA-ZÀ-ÿ]$/)) {
            e.preventDefault()
            const newGrid = [...grid]
            newGrid[row][col].userAnswer = e.key.toUpperCase()
            setGrid(newGrid)
            moveToNextCell(row, col)
        } else if (e.key === 'Backspace') {
            e.preventDefault()
            const newGrid = [...grid]
            if (newGrid[row][col].userAnswer) {
                // Clear current cell
                newGrid[row][col].userAnswer = ''
                setGrid(newGrid)
            } else {
                // Move to previous cell and clear it
                moveToPreviousCell(row, col)
            }
        } else if (e.key === 'Delete') {
            e.preventDefault()
            const newGrid = [...grid]
            newGrid[row][col].userAnswer = ''
            setGrid(newGrid)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            moveRight(row, col)
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            moveLeft(row, col)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            moveDown(row, col)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            moveUp(row, col)
        } else if (e.key === ' ') {
            e.preventDefault()
            // Toggle direction on spacebar
            const newDir = direction === 'H' ? 'V' : 'H'
            setDirection(newDir)
            const word = findWordAtPosition(row, col, newDir)
            setSelectedWord(word)
        }
    }

    function moveToNextCell(row: number, col: number) {
        if (!selectedWord) return

        if (direction === 'H') {
            const nextCol = col + 1
            if (nextCol < selectedWord.col + selectedWord.length &&
                selectedWord.row === row &&
                nextCol < grid[0].length &&
                !grid[row][nextCol].isBlack) {
                setSelectedCell({ row, col: nextCol })
            }
        } else {
            const nextRow = row + 1
            if (nextRow < selectedWord.row + selectedWord.length &&
                selectedWord.col === col &&
                nextRow < grid.length &&
                !grid[nextRow][col].isBlack) {
                setSelectedCell({ row: nextRow, col })
            }
        }
    }

    function moveToPreviousCell(row: number, col: number) {
        if (!selectedWord) return

        if (direction === 'H') {
            const prevCol = col - 1
            if (prevCol >= selectedWord.col &&
                selectedWord.row === row &&
                !grid[row][prevCol].isBlack) {
                setSelectedCell({ row, col: prevCol })
                const newGrid = [...grid]
                newGrid[row][prevCol].userAnswer = ''
                setGrid(newGrid)
            }
        } else {
            const prevRow = row - 1
            if (prevRow >= selectedWord.row &&
                selectedWord.col === col &&
                !grid[prevRow][col].isBlack) {
                setSelectedCell({ row: prevRow, col })
                const newGrid = [...grid]
                newGrid[prevRow][col].userAnswer = ''
                setGrid(newGrid)
            }
        }
    }

    function moveRight(row: number, col: number) {
        for (let c = col + 1; c < grid[0].length; c++) {
            if (!grid[row][c].isBlack) {
                setSelectedCell({ row, col: c })
                setDirection('H')
                const word = findWordAtPosition(row, c, 'H')
                setSelectedWord(word)
                return
            }
        }
    }

    function moveLeft(row: number, col: number) {
        for (let c = col - 1; c >= 0; c--) {
            if (!grid[row][c].isBlack) {
                setSelectedCell({ row, col: c })
                setDirection('H')
                const word = findWordAtPosition(row, c, 'H')
                setSelectedWord(word)
                return
            }
        }
    }

    function moveDown(row: number, col: number) {
        for (let r = row + 1; r < grid.length; r++) {
            if (!grid[r][col].isBlack) {
                setSelectedCell({ row: r, col })
                setDirection('V')
                const word = findWordAtPosition(r, col, 'V')
                setSelectedWord(word)
                return
            }
        }
    }

    function moveUp(row: number, col: number) {
        for (let r = row - 1; r >= 0; r--) {
            if (!grid[r][col].isBlack) {
                setSelectedCell({ row: r, col })
                setDirection('V')
                const word = findWordAtPosition(r, col, 'V')
                setSelectedWord(word)
                return
            }
        }
    }
    if (!puzzle) {
        return (
            <PublicLayout>
                <div className="p-8 text-white">Loading...</div>
            </PublicLayout>
        )
    }

    function formatTime(seconds: number): string {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const gridSize = puzzle.PuzzleConfig.grid_size
    const acrossWords = words.filter(w => w.dir === 'H')
    const downWords = words.filter(w => w.dir === 'V')

    return (
        <PublicLayout>
            <div className="min-h-screen bg-gray-900 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">
                                    {puzzle.PuzzleConfig.name}
                                </h1>
                                <p className="text-gray-400">
                                    Grid: {gridSize}x{gridSize} • Words: {words.length}
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Progress Bar */}
                                <div className="bg-gray-800 px-6 py-3 rounded-lg border border-gray-700">
                                    <div className="text-gray-400 text-xs mb-1">Progresso</div>
                                    <div className="text-xl font-bold text-white mb-2">
                                        {progress.filled}/{progress.total} células
                                    </div>
                                    <div className="w-32 bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${progress.percentage}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Timer */}
                                {user && sessionId && (
                                    <div className="bg-gray-800 px-6 py-3 rounded-lg border border-gray-700">
                                        <div className="text-gray-400 text-xs mb-1">Tempo</div>
                                        <div className="text-2xl font-bold text-white font-mono">
                                            ⏱️ {formatTime(elapsedSeconds + timePenalty)}
                                        </div>
                                        {timePenalty > 0 && (
                                            <div className="text-xs text-orange-400 mt-1">
                                                +{timePenalty}s penalização ({hintsUsed} {hintsUsed === 1 ? 'dica' : 'dicas'})
                                            </div>
                                        )}
                                        {!isTimerRunning && (
                                            <div className="text-xs text-green-400 mt-1">✓ Completo</div>
                                        )}
                                    </div>
                                )}

                                {/* Save Indicator */}
                                {user && sessionId && (
                                    <div className="text-sm text-gray-400">
                                        {isSaving ? (
                                            <span className="text-blue-400">💾 A guardar...</span>
                                        ) : (
                                            <span className="text-green-400">✓ Guardado</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile: Current Clue Bar */}
                    {selectedWord && (
                        <div className="md:hidden bg-blue-900 p-3 rounded-lg mb-4 border border-blue-700">
                            <div className="text-blue-200 text-sm font-semibold mb-1">
                                {selectedWord.number} {selectedWord.dir === 'H' ? 'Across' : 'Down'}
                            </div>
                            <div className="text-white">{selectedWord.clue}</div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Grid Section */}
                        <div className="flex-1">
                            {/* Controls */}
                            <div className="bg-gray-800 p-4 rounded-lg mb-4 flex flex-wrap gap-2">
                                <button
                                    onClick={checkSolution}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex-1 md:flex-none"
                                >
                                    Check
                                </button>
                                <button
                                    onClick={revealWord}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex-1 md:flex-none"
                                >
                                    Reveal Word
                                </button>
                                <button
                                    onClick={revealAll}
                                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 flex-1 md:flex-none"
                                >
                                    Reveal All
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex-1 md:flex-none"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => setShowAllClues(!showAllClues)}
                                    className="md:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex-1"
                                >
                                    {showAllClues ? 'Hide' : 'Show'} Clues
                                </button>
                                <button
                                    onClick={() => setShowSettings(true)}
                                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                    ⚙️ Definições
                                </button>

                                <button
                                    onClick={revealLetter}
                                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                                >
                                    💡 Dica (-{REVEAL_LETTER_PENALTY}s)
                                </button>
                            </div>

                            {/* Crossword Grid */}
                            <div className="bg-gray-800 p-4 md:p-8 rounded-lg inline-block max-w-full">
                                <div
                                    className="grid gap-0 bg-black"
                                    style={{
                                        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                                        maxWidth: '95vw',
                                        width: gridSize <= 15 ? 'min(600px, 95vw)' : 'min(800px, 95vw)'
                                    }}
                                >
                                    {grid.map((row, r) =>
                                        row.map((cell, c) => {
                                            const isSelected = selectedCell?.row === r && selectedCell?.col === c
                                            const isInWord = isCellInSelectedWord(r, c)
                                            const isCorrect = showCorrectImmediately &&
                                                cell.userAnswer &&
                                                cell.userAnswer === cell.letter

                                            return (
                                                <div
                                                    key={`${r}-${c}`}
                                                    onClick={() => handleCellClick(r, c)}
                                                    className={`
                                                        aspect-square relative border border-gray-700
                                                        ${cell.isBlack ? 'bg-black' : 'bg-white cursor-pointer'}
                                                        ${isSelected ? 'ring-2 ring-blue-500' : ''}
                                                        ${isInWord && !isSelected ? 'bg-blue-100' : ''}
                                                        ${isCorrect ? 'bg-green-100' : ''}
                                                    `}
                                                >
                                                    {!cell.isBlack && (
                                                        <>
                                                            {cell.number && (
                                                                <span className="absolute top-0.5 left-0.5 text-[10px] md:text-xs font-semibold text-gray-700">
                                                                    {cell.number}
                                                                </span>
                                                            )}
                                                            <input
                                                                ref={(el) => { inputRefs.current[`${r}-${c}`] = el }}
                                                                type="text"
                                                                maxLength={1}
                                                                value={cell.userAnswer || ''}
                                                                onKeyDown={(e) => handleKeyDown(e, r, c)}
                                                                onChange={() => { }}
                                                                className={`
        w-full h-full text-center font-bold bg-transparent
        text-base md:text-2xl uppercase
        focus:outline-none
        ${isCorrect ? 'text-green-700' : 'text-gray-900'}
    `}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {score > 0 && (
                                <div className="mt-4 p-4 bg-gray-800 rounded-lg text-center">
                                    <span className="text-2xl font-bold text-green-400">{score}%</span>
                                    <span className="text-gray-400 ml-2">Complete</span>
                                </div>
                            )}
                        </div>

                        {/* Clues Section */}
                        <div className={`w-full md:w-96 ${showAllClues ? 'block' : 'hidden md:block'}`}>
                            <div className="bg-gray-800 p-4 rounded-lg sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
                                        Across
                                    </h3>
                                    <div className="space-y-2">
                                        {acrossWords.map(word => (
                                            <div
                                                key={`across-${word.number}`}
                                                onClick={() => handleClueClick(word)}
                                                className={`
                                                    p-2 rounded cursor-pointer transition-colors
                                                    ${selectedWord?.number === word.number && selectedWord?.dir === word.dir
                                                        ? 'bg-blue-900 border-l-4 border-blue-500'
                                                        : 'hover:bg-gray-700'
                                                    }
                                                `}
                                            >
                                                <span className="text-blue-400 font-semibold mr-2">{word.number}.</span>
                                                <span className="text-gray-300">{word.clue}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
                                        Down
                                    </h3>
                                    <div className="space-y-2">
                                        {downWords.map(word => (
                                            <div
                                                key={`down-${word.number}`}
                                                onClick={() => handleClueClick(word)}
                                                className={`
                                                    p-2 rounded cursor-pointer transition-colors
                                                    ${selectedWord?.number === word.number && selectedWord?.dir === word.dir
                                                        ? 'bg-blue-900 border-l-4 border-blue-500'
                                                        : 'hover:bg-gray-700'
                                                    }
                                                `}
                                            >
                                                <span className="text-blue-400 font-semibold mr-2">{word.number}.</span>
                                                <span className="text-gray-300">{word.clue}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-4">⚙️ Definições</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-white font-medium">Mostrar respostas corretas</div>
                                    <div className="text-gray-400 text-sm">
                                        Células ficam verdes imediatamente quando corretas
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showCorrectImmediately}
                                        onChange={(e) => toggleShowCorrect(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-white font-medium mb-2">Penalizações</h3>
                                <div className="text-gray-400 text-sm space-y-1">
                                    <div>💡 Revelar letra: +{REVEAL_LETTER_PENALTY}s</div>
                                    <div>📝 Revelar palavra: +{REVEAL_WORD_PENALTY}s</div>
                                    <div>🎯 Revelar tudo: desqualifica do leaderboard</div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSettings(false)}
                            className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
            {/* Completion Modal */}
            {showCompletionModal && completionStats && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full border-4 border-green-500 relative">
                        {/* Celebration Header */}
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-4">🎉</div>
                            <h2 className="text-3xl font-bold text-white mb-2">Parabéns!</h2>
                            <p className="text-gray-300">Completaste o puzzle!</p>
                        </div>

                        {/* Stats */}
                        <div className="bg-gray-900 rounded-lg p-6 mb-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">⏱️ Tempo:</span>
                                <span className="text-2xl font-bold text-white font-mono">
                                    {formatTime(completionStats.time)}
                                </span>
                            </div>

                            {completionStats.penalty > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Penalizações:</span>
                                    <span className="text-orange-400">
                                        +{completionStats.penalty}s ({completionStats.hintsUsed} {completionStats.hintsUsed === 1 ? 'dica' : 'dicas'})
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">📊 Pontuação:</span>
                                <span className="text-2xl font-bold text-green-400">
                                    {completionStats.score}%
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">📅 Data:</span>
                                <span className="text-white">
                                    {new Date().toLocaleDateString('pt-PT')}
                                </span>
                            </div>
                        </div>

                        {/* Share Button */}
                        <button
                            onClick={() => {
                                const shareText = `🎯 Completei um puzzle de palavras cruzadas!\n⏱️ Tempo: ${formatTime(completionStats.time)}${completionStats.penalty > 0 ? ` (+${completionStats.penalty}s penalização)` : ''}\n📊 Pontuação: ${completionStats.score}%`

                                if (navigator.share) {
                                    navigator.share({
                                        title: 'Puzzle Completo!',
                                        text: shareText,
                                    }).catch(() => { })
                                } else {
                                    navigator.clipboard.writeText(shareText)
                                    alert('Resultado copiado para o clipboard!')
                                }
                            }}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-3 font-medium"
                        >
                            📤 Partilhar Resultado
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowCompletionModal(false)}
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </PublicLayout>
    )
}
