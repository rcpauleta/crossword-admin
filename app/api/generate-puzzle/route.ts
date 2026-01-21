import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Grid generation algorithm (unchanged)
function generateCrosswordGrid(wordList: any[], gridSize: number) {
  const MIN_WORDS = 10
  const MAX_RETRIES = 50000

  const grid: (string | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null))
  const placedWords: any[] = []
  let attempts = 0

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
    const body = await request.json()
    const { configId, languageId, gridSize, maxWords, difficulty } = body

    let config: any = null
    let targetLanguage = languageId || 'PT-PT'
    let targetGridSize = gridSize || 15
    let targetWordCount = maxWords || 30
    let targetDifficulty = difficulty || 'medium'

    // If configId is provided, fetch config
    if (configId) {
      const { data: configData, error: configError } = await supabase
        .from('PuzzleConfig')
        .select('*')
        .eq('id', configId)
        .single()

      if (configError || !configData) {
        return NextResponse.json(
          { success: false, error: 'Config not found' },
          { status: 404 }
        )
      }

      config = configData
      targetLanguage = config.language_id
      targetGridSize = config.grid_size
      targetWordCount = config.number_of_words || 30
      targetDifficulty = config.difficulty_level || 'medium'
    }

    console.log('Generating puzzle:', { targetLanguage, targetGridSize, targetWordCount, targetDifficulty })

    // Use get_random_words function with proper distribution
    const { data: words, error: wordsError } = await supabase
      .rpc('get_random_words', {
        lang_id: targetLanguage,
        word_count: targetWordCount * 2,  // Get 2x words for better grid generation
        diff_level: targetDifficulty
      })

    if (wordsError || !words || words.length < 10) {
      console.error('Error fetching words:', wordsError)
      return NextResponse.json(
        { success: false, error: `Not enough words with clues found for language ${targetLanguage}. Need at least 10 words.` },
        { status: 400 }
      )
    }

    // Map clues to words
    const wordListForGrid = words.map((word: any) => ({
      normalized: word.normalized_text.toUpperCase(),
      word: word.display_text,
      display_word: word.display_text,
      clue: word.clue 
    }))

    if (wordListForGrid.length < 10) {
      return NextResponse.json(
        { success: false, error: `Not enough words with clues found. Only ${wordListForGrid.length} words available. Need at least 10.` },
        { status: 400 }
      )
    }

    console.log(`Found ${wordListForGrid.length} words with clues (${words.filter((w: any) => w.word_length <= 5).length} short, ${words.filter((w: any) => w.word_length >= 6 && w.word_length <= 9).length} medium, ${words.filter((w: any) => w.word_length >= 10).length} large)`)

    // Generate grid
    const { grid, placedWords, gridDensity } = generateCrosswordGrid(
      wordListForGrid.slice(0, targetWordCount),
      targetGridSize
    )

    if (placedWords.length < 10) {
      return NextResponse.json(
        { success: false, error: `Could only place ${placedWords.length} words. Grid generation failed.` },
        { status: 400 }
      )
    }

    // Save to GeneratedPuzzle
    const { data: puzzle, error: puzzleError } = await supabase
      .from('GeneratedPuzzle')
      .insert({
        puzzle_config_id: configId || null,
        grid_JSON: JSON.stringify(grid),
        words_JSON: JSON.stringify(placedWords),
        grid_density: gridDensity,
        language_id: targetLanguage,
        total_words: placedWords.length
      })
      .select()
      .single()

    if (puzzleError) {
      console.error('Error saving puzzle:', puzzleError)
      throw puzzleError
    }

    return NextResponse.json({
      success: true,
      puzzle: {
        id: puzzle.id,
        totalWords: placedWords.length,
        gridSize: targetGridSize,
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
