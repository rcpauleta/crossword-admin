declare module 'hunspell-spellchecker' {
  class Spellchecker {
    constructor()
    use(dictionary: any): void
    check(word: string): boolean
    suggest(word: string, limit?: number): string[]
  }
  
  export function parse(data: { aff: Buffer | string; dic: Buffer | string }): any
  
  export default Spellchecker
}
