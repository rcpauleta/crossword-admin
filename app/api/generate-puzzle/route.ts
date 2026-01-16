import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Grid generation algorithm (your JS logic converted to TypeScript)
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
      word_difficulty: wordObj.word_difficulty,
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

    // 1. Fetch config with related data
    const { data: config, error: configError } = await supabase
      .from('PuzzleConfig')
      .select(`
        *,
        Theme!inner(id, name, is_generic_builder),
        Language!inner(ISO, name),
        Difficulty!inner(id, order)
      `)
      .eq('id', configId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    // 2. Fetch theme words
    const { data: themeWords } = await supabase
      .from('Word')
      .select(`
        id,
        normalized_text,
        display_text,
        length,
        difficulty_id,
        Word_Theme!inner(theme_id)
      `)
      .eq('Word_Theme.theme_id', config.theme_id)
      .lte('difficulty_id', config.difficulty_id)
      .eq('language_id', config.language_id)

    // 3. Fetch generic/filler words
    const { data: fillerWords } = await supabase
      .from('Word')
      .select(`
        id,
        normalized_text,
        display_text,
        length,
        difficulty_id,
        Word_Theme!inner(theme_id, Theme!inner(is_generic_builder))
      `)
      .eq('Word_Theme.Theme.is_generic_builder', true)
      .eq('language_id', config.language_id)
      .lte('difficulty_id', config.difficulty_id)
      .lte('length', 7)

    // 4. Calculate target counts (40% theme, 60% filler)
    const targetCount = config.number_of_words
    const themeTarget = Math.floor(targetCount * 0.4)
    const fillerTarget = Math.floor(targetCount * 0.8)

    // 5. Shuffle and select
    const shuffleArray = (arr: any[]) => arr.sort(() => Math.random() - 0.5)
    const selectedTheme = shuffleArray(themeWords || []).slice(0, themeTarget)
    const selectedFiller = shuffleArray(fillerWords || []).slice(0, fillerTarget)

    const selectedWords = [...selectedTheme, ...selectedFiller]
    const uniqueWords = Array.from(new Map(selectedWords.map(w => [w.id, w])).values())

    // 6. Fetch clues for selected words
    const wordIds = uniqueWords.map(w => w.id)
    const { data: clues } = await supabase
      .from('Clue')
      .select('word_id, clue, difficulty_id, theme_id')
      .in('word_id', wordIds)
      .eq('language_id', config.language_id)
      .lte('difficulty_id', config.difficulty_id)

    // 7. Map clues to words
    const wordListForGrid = uniqueWords.map(word => {
      const wordClues = clues?.filter(c => c.word_id === word.id) || []
      
      // Prioritize: Theme match > closest difficulty > random
      const bestClue = wordClues.sort((a, b) => {
        const aThemeMatch = a.theme_id === config.theme_id ? 0 : 1
        const bThemeMatch = b.theme_id === config.theme_id ? 0 : 1
        if (aThemeMatch !== bThemeMatch) return aThemeMatch - bThemeMatch
        
        const aDiff = Math.abs(a.difficulty_id - config.difficulty_id)
        const bDiff = Math.abs(b.difficulty_id - config.difficulty_id)
        return aDiff - bDiff
      })[0]

      if (!bestClue) return null

      return {
        normalized: word.normalized_text.toUpperCase(),
        word: word.display_text,
        display_word: word.display_text,
        clue: bestClue.clue,
        word_difficulty: word.difficulty_id
      }
    }).filter(Boolean)

    if (wordListForGrid.length < 10) {
      return NextResponse.json(
        { success: false, error: `Not enough words with clues found. Only ${wordListForGrid.length} words available. Need at least 10.` },
        { status: 400 }
      )
    }

    // 8. Generate grid
    const { grid, placedWords, gridDensity } = generateCrosswordGrid(
      wordListForGrid.slice(0, targetCount),
      config.grid_size
    )

    // 9. Save to GeneratedPuzzle
    const { data: puzzle, error: puzzleError } = await supabase
      .from('GeneratedPuzzle')
      .insert({
        puzzle_config_id: config.id,
        grid_JSON: JSON.stringify(grid),
        words_JSON: JSON.stringify(placedWords),
        grid_density: gridDensity,
        theme_id: config.theme_id,
        language_id: config.language_id,
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
        gridDensity: gridDensity.toFixed(2) + '%'
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
