import PublicLayout from './components/PublicLayout'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <PublicLayout>
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo/Title */}
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-white mb-4">
                🧩 Crossword
              </h1>
              <p className="text-xl md:text-2xl text-gray-300">
                Desafie a sua mente com palavras cruzadas em Português
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/play"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors shadow-lg"
              >
                🎮 Jogar Agora
              </Link>
              <Link
                href="/play"
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors shadow-lg"
              >
                📚 Ver Puzzles
              </Link>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="bg-gray-800 bg-opacity-50 backdrop-blur p-6 rounded-lg border border-gray-700">
                <div className="text-4xl mb-4">🇵🇹</div>
                <h3 className="text-xl font-bold text-white mb-2">Em Português</h3>
                <p className="text-gray-300">
                  Milhares de palavras e pistas criativas em Português
                </p>
              </div>

              <div className="bg-gray-800 bg-opacity-50 backdrop-blur p-6 rounded-lg border border-gray-700">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-white mb-2">Vários Níveis</h3>
                <p className="text-gray-300">
                  De iniciante a expert, temos puzzles para todos
                </p>
              </div>

              <div className="bg-gray-800 bg-opacity-50 backdrop-blur p-6 rounded-lg border border-gray-700">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="text-xl font-bold text-white mb-2">Responsive</h3>
                <p className="text-gray-300">
                  Jogue no computador, tablet ou smartphone
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-gray-800 bg-opacity-30 backdrop-blur p-4 rounded-lg">
                <div className="text-3xl font-bold text-blue-400">27K+</div>
                <div className="text-gray-400 text-sm">Palavras</div>
              </div>
              <div className="bg-gray-800 bg-opacity-30 backdrop-blur p-4 rounded-lg">
                <div className="text-3xl font-bold text-purple-400">27K+</div>
                <div className="text-gray-400 text-sm">Pistas</div>
              </div>
              <div className="bg-gray-800 bg-opacity-30 backdrop-blur p-4 rounded-lg">
                <div className="text-3xl font-bold text-green-400">∞</div>
                <div className="text-gray-400 text-sm">Puzzles</div>
              </div>
              <div className="bg-gray-800 bg-opacity-30 backdrop-blur p-4 rounded-lg">
                <div className="text-3xl font-bold text-yellow-400">100%</div>
                <div className="text-gray-400 text-sm">Grátis</div>
              </div>
            </div>

            {/* How to Play */}
            <div className="mt-16 text-left bg-gray-800 bg-opacity-50 backdrop-blur p-8 rounded-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Como Jogar
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                      1
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Escolha um Puzzle</h4>
                      <p className="text-gray-300 text-sm">
                        Navegue pelos puzzles disponíveis e escolha o tamanho e dificuldade
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                      2
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Leia as Pistas</h4>
                      <p className="text-gray-300 text-sm">
                        Clique nas pistas para destacar as palavras no grid
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                      3
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Preencha as Palavras</h4>
                      <p className="text-gray-300 text-sm">
                        Use o teclado para escrever. Setas para navegar
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                      4
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Verifique e Complete</h4>
                      <p className="text-gray-300 text-sm">
                        Clique em "Check" para ver o seu progresso
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="mt-16">
              <Link
                href="/play"
                className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-5 px-12 rounded-full text-xl transition-all shadow-2xl transform hover:scale-105"
              >
                Começar a Jogar 🎯
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-8">
          <div className="container mx-auto px-4 text-center text-gray-400">
            <p>© 2026 Crossword PT. Feito com ❤️ para amantes de palavras cruzadas.</p>
          </div>
        </footer>
      </div>
    </PublicLayout>
  )
}
