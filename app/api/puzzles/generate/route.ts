import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/supabase'

// Grid generation algorithm (unchanged)
function generateCrosswordGrid(wordList: any[], gridSize: number) {
    const MIN_WORDS = 10
    const MAX_RETRIES = 50000

    const grid: (string | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null))
    const placedWords: any[] = []
    let attempts = 0

    // Sort: Longest words first
    wordList.sort((a, b) => b.normalized.length - a.normalized.length)

    function inBounds(r: number, c: number) {
        return r >= 0 && r < gridSize && c >= 0 && c < gridSize
    }

    function isEmpty(r: number, c: number) {
        return inBounds(r, c) && grid[r][c] === null
    }

    function canPlace(word: string, r: number, c: number, dir: 'H' | 'V') {
        const len = word.length
        let intersections = 0

        if (dir === 'H' && c + len > gridSize) return false
        if (dir === 'V' && r + len > gridSize) return false
        if (r < 0 || c < 0) return false

        // Check head/tail
        const rBefore = dir === 'H' ? r : r - 1
        const cBefore = dir === 'H' ? c - 1 : c
        const rAfter = dir === 'H' ? r : r + len
        const cAfter = dir === 'H' ? c + len : c

        if (inBounds(rBefore, cBefore) && !isEmpty(rBefore, cBefore)) return false
        if (inBounds(rAfter, cAfter) && !isEmpty(rAfter, cAfter)) return false

        for (let i = 0; i < len; i++) {
            const cr = dir === 'H' ? r : r + i
            const cc = dir === 'H' ? c + i : c
            const cell = grid[cr][cc]

            if (cell !== null) {
                if (cell !== word[i]) return false
                intersections++
            } else {
                const n1r = dir === 'H' ? cr - 1 : cr
                const n1c = dir === 'H' ? cc : cc - 1
                const n2r = dir === 'H' ? cr + 1 : cr
                const n2c = dir === 'H' ? cc : cc + 1

                if (inBounds(n1r, n1c) && !isEmpty(n1r, n1c)) return false
                if (inBounds(n2r, n2c) && !isEmpty(n2r, n2c)) return false
            }
        }

        if (placedWords.length > 0 && intersections === 0) return false
        return true
    }

    function writeWord(wordObj: any, r: number, c: number, dir: 'H' | 'V') {
        const word = wordObj.normalized
        for (let i = 0; i < word.length; i++) {
            const cr = dir === 'H' ? r : r + i
            const cc = dir === 'H' ? c + i : c
            grid[cr][cc] = word[i]
        }

        placedWords.push({
            word: wordObj.normalized,
            display_word: wordObj.display_word || wordObj.word,
            clue: wordObj.clue,
            row: r,
            col: c,
            dir: dir,
            orientation: dir === 'H' ? 'Horizontal' : 'Vertical',
            length: word.length
        })
    }

    function solve(index: number): boolean {
        attempts++
        if (attempts > MAX_RETRIES) return true
        if (index >= wordList.length) return true

        const currentWord = wordList[index]
        const text = currentWord.normalized
        const candidates: { r: number; c: number; dir: 'H' | 'V' }[] = []

        if (placedWords.length === 0) {
            const startCol = Math.floor((gridSize - text.length) / 2)
            const startRow = Math.floor(gridSize / 2)
            candidates.push({ r: startRow, c: startCol, dir: 'H' })
        } else {
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    if (grid[r][c] !== null && text.indexOf(grid[r][c]!) !== -1) {
                        const matchChar = grid[r][c]!
                        for (let k = 0; k < text.length; k++) {
                            if (text[k] === matchChar) {
                                const startCol = c - k
                                const startRow = r - k

                                if (startCol >= 0) candidates.push({ r: r, c: startCol, dir: 'H' })
                                if (startRow >= 0) candidates.push({ r: startRow, c: c, dir: 'V' })
                            }
                        }
                    }
                }
            }
        }

        let placed = false
        for (let i = 0; i < candidates.length; i++) {
            const cand = candidates[i]
            if (canPlace(text, cand.r, cand.c, cand.dir)) {
                writeWord(currentWord, cand.r, cand.c, cand.dir)
                placed = true
                solve(index + 1)
                break
            }
        }

        if (!placed) {
            solve(index + 1)
        }
        return true
    }

    solve(0)

    // Sort and assign numbers
    placedWords.sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row
        return a.col - b.col
    })

    const coordToNumber: { [key: string]: number } = {}
    let currentNumber = 1

    for (let i = 0; i < placedWords.length; i++) {
        const w = placedWords[i]
        const key = `${w.row},${w.col}`

        if (coordToNumber[key]) {
            w.number = coordToNumber[key]
        } else {
            w.number = currentNumber
            coordToNumber[key] = currentNumber
            currentNumber++
        }
    }

    // Calculate density
    let filled = 0
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r][c] !== null) filled++
        }
    }
    const gridDensity = (filled / (gridSize * gridSize)) * 100

    return {
        grid: grid.map(row => ({ List: row })),
        placedWords,
        gridDensity
    }
}

export async function POST(request: NextRequest) {
    try {
        const { configId } = await request.json()

        // 1. Fetch config
        const { data: config, error: configError } = await supabase
            .from('PuzzleConfig')
            .select(`
        *,
        Language!inner(ISO, name)
      `)
            .eq('id', configId)
            .single()

        if (configError || !config) {
            return NextResponse.json(
                { success: false, error: 'Config not found' },
                { status: 404 }
            )
        }

        console.log(`Generating puzzle for ${config.Language.name} with ${config.number_of_words} words`)

        // Fetch random words that have clues
        const wordsToFetch = Math.min(config.number_of_words * 3, 100)

        const { data: allWords, error: wordsError } = await supabase
            .rpc('get_random_words', {
                lang_id: config.language_id,
                word_count: wordsToFetch,
                diff_level: 'medium' // or get from config if you add difficulty to PuzzleConfig
            })

        if (wordsError || !allWords || allWords.length < 10) {
            console.error('Error fetching words:', wordsError)
            return NextResponse.json(
                {
                    success: false,
                    error: `Not enough words with clues found. Only ${allWords?.length || 0} words available. Generate more clues first!`
                },
                { status: 400 }
            )
        }

        console.log(`Fetched ${allWords.length} random words:`, allWords.slice(0, 5).map((w: any) => w.display_text))

        if (allWords.length < 10) {
            return NextResponse.json(
                { success: false, error: `Not enough words found. Only ${allWords.length} words available.` },
                { status: 400 }
            )
        }

        const wordListForGrid = allWords.map((word: { normalized_text: any; display_text: any }) => ({
            normalized: word.normalized_text,
            word: word.display_text,
            display_word: word.display_text,
            clue: `[Clue for ${word.display_text}]` // Placeholder clue for now
        }))

        console.log(`Prepared ${wordListForGrid.length} words for grid generation`)

        // 4. Generate grid
        const { grid, placedWords, gridDensity } = generateCrosswordGrid(
            wordListForGrid,
            config.grid_size
        )

        console.log(`Grid generated: ${placedWords.length} words placed, ${gridDensity.toFixed(2)}% density`)

        if (placedWords.length < 10) {
            return NextResponse.json(
                { success: false, error: `Grid generation failed. Only ${placedWords.length} words placed. Try again or adjust config.` },
                { status: 400 }
            )
        }

        // After crossword generation, fetch clues for placed words
        const wordIds = placedWords.map(pw => {
            const word = allWords.find((w: { normalized_text: any }) => w.normalized_text === pw.word)
            return word?.id
        }).filter(Boolean)

        const { data: clues } = await supabase
            .from('Clue')
            .select('word_id, clue_text')
            .in('word_id', wordIds)

        // Map clues to words
        const clueMap = new Map(clues?.map(c => [c.word_id, c.clue_text]) || [])

        const wordsWithClues = placedWords.map(pw => {
            const word = allWords.find((w: { normalized_text: any }) => w.normalized_text === pw.word)
            return {
                ...pw,
                clue: clueMap.get(word?.id) || `[No clue for ${pw.display_word}]`
            }
        })

        // 5. Save to GeneratedPuzzle
        const { data: puzzle, error: puzzleError } = await supabase
            .from('GeneratedPuzzle')
            .insert({
                puzzle_config_id: config.id,
                language_id: config.language_id,
                grid_JSON: JSON.stringify(grid),
                words_JSON: JSON.stringify(wordsWithClues),
                grid_density: gridDensity,
                total_words: placedWords.length
            })
            .select()
            .single()

        if (puzzleError) throw puzzleError

        return NextResponse.json({
            success: true,
            puzzle: {
                id: puzzle.id,
                totalWords: placedWords.length,
                gridSize: config.grid_size,
                gridDensity: gridDensity.toFixed(2) + '%',
                placedWords: placedWords,
                grid: grid
            }
        })

    } catch (error: any) {
        console.error('Puzzle generation error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
