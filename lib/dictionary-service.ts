import Spellchecker from 'hunspell-spellchecker'
import fs from 'fs'
import path from 'path'

class DictionaryService {
    private spellcheckers: Map<string, any> = new Map()
    private wordLists: Map<string, Set<string>> = new Map()

    async loadDictionary(languageISO: string): Promise<void> {
        if (this.spellcheckers.has(languageISO)) return

        const dictPath = path.join(process.cwd(), 'public', 'dictionaries', `${languageISO}.dic`)
        const affPath = path.join(process.cwd(), 'public', 'dictionaries', `${languageISO}.aff`)

        if (!fs.existsSync(dictPath) || !fs.existsSync(affPath)) {
            throw new Error(`Dictionary files not found for language: ${languageISO}`)
        }

        const spellchecker = new Spellchecker()
        const dictBuffer = fs.readFileSync(dictPath)
        const affBuffer = fs.readFileSync(affPath)

        const dict = spellchecker.parse({
            aff: affBuffer,
            dic: dictBuffer
        })

        spellchecker.use(dict)
        this.spellcheckers.set(languageISO, spellchecker)
    }

    async isValidWord(word: string, languageISO: string): Promise<boolean> {
        await this.loadDictionary(languageISO)
        const spellchecker = this.spellcheckers.get(languageISO)
        return spellchecker.check(word)
    }

    async getAllWords(languageISO: string): Promise<string[]> {
        if (this.wordLists.has(languageISO)) {
            return Array.from(this.wordLists.get(languageISO)!)
        }

        const dictPath = path.join(process.cwd(), 'public', 'dictionaries', `${languageISO}.dic`)
        const dictContent = fs.readFileSync(dictPath, 'utf-8')
        const lines = dictContent.split('\n')
        
        // First line is word count, skip it
        const words = new Set<string>()
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue
            
            // Dictionary format: word/flags
            const word = line.split('/')[0].trim()
            if (word && word.length > 0) {
                words.add(word)
            }
        }

        this.wordLists.set(languageISO, words)
        return Array.from(words)
    }
}

export const dictionaryService = new DictionaryService()
