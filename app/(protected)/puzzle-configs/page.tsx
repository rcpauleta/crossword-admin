'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

type PuzzleConfig = {
    id: number
    name: string
    grid_size: number
    number_of_words: number
    theme_id: number
    language_id: string
    difficulty_id: string
    created_at: string
    Theme: { name: string }
    Language: { name: string }
    Difficulty: { name: string }
}

export default function PuzzleConfigsPage() {
    const [configs, setConfigs] = useState<PuzzleConfig[]>([])
    const [themes, setThemes] = useState<any[]>([])
    const [languages, setLanguages] = useState<any[]>([])
    const [difficulties, setDifficulties] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingConfig, setEditingConfig] = useState<PuzzleConfig | null>(null)
    const [saving, setSaving] = useState(false)
    const [generatingConfigId, setGeneratingConfigId] = useState<number | null>(null)

    // Filter states
    const [searchTerm, setSearchTerm] = useState('')
    const [filterTheme, setFilterTheme] = useState<string>('all')
    const [filterLanguage, setFilterLanguage] = useState<string>('all')

    // Form fields
    const [name, setName] = useState('')
    const [gridSize, setGridSize] = useState('15')
    const [numberOfWords, setNumberOfWords] = useState('50')
    const [themeId, setThemeId] = useState('')
    const [languageId, setLanguageId] = useState('')
    const [difficultyId, setDifficultyId] = useState('')

    useEffect(() => {
        fetchDropdownData()
        fetchConfigs()
    }, [])

    async function fetchDropdownData() {
        const [themesRes, languagesRes, difficultiesRes] = await Promise.all([
            supabase.from('Theme').select('id, name').eq('is_active', true).order('name'),
            supabase.from('Language').select('ISO, name').eq('is_active', true).order('name'),
            supabase.from('Difficulty').select('id, name').eq('is_active', true).order('order')
        ])

        if (themesRes.data) setThemes(themesRes.data)
        if (languagesRes.data) setLanguages(languagesRes.data)
        if (difficultiesRes.data) setDifficulties(difficultiesRes.data)
    }

    async function fetchConfigs() {
        const { data, error } = await supabase
            .from('PuzzleConfig')
            .select(`
        *,
        Theme!inner(name),
        Language!inner(name),
        Difficulty!inner(name)
      `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching configs:', error)
        } else {
            setConfigs(data || [])
        }
        setLoading(false)
    }

    const filteredConfigs = configs.filter(config => {
        if (searchTerm && !config.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false
        }
        if (filterTheme !== 'all' && config.theme_id.toString() !== filterTheme) return false
        if (filterLanguage !== 'all' && config.language_id !== filterLanguage) return false
        return true
    })

    function openNewModal() {
        setEditingConfig(null)
        resetForm()
        setIsModalOpen(true)
    }

    function openEditModal(config: PuzzleConfig) {
        setEditingConfig(config)
        setName(config.name)
        setGridSize(config.grid_size.toString())
        setNumberOfWords(config.number_of_words.toString())
        setThemeId(config.theme_id.toString())
        setLanguageId(config.language_id)
        setDifficultyId(config.difficulty_id)
        setIsModalOpen(true)
    }

    function closeModal() {
        setIsModalOpen(false)
        setEditingConfig(null)
        resetForm()
    }

    function resetForm() {
        setName('')
        setGridSize('15')
        setNumberOfWords('50')
        setThemeId('')
        setLanguageId('')
        setDifficultyId('')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        const configData = {
            name,
            grid_size: parseInt(gridSize),
            number_of_words: parseInt(numberOfWords),
            theme_id: parseInt(themeId),
            language_id: languageId,
            difficulty_id: difficultyId
        }

        let error

        if (editingConfig) {
            const result = await supabase
                .from('PuzzleConfig')
                .update(configData)
                .eq('id', editingConfig.id)
            error = result.error
        } else {
            const result = await supabase
                .from('PuzzleConfig')
                .insert([configData])
            error = result.error
        }

        if (error) {
            alert(`Error ${editingConfig ? 'updating' : 'creating'} config: ` + error.message)
        } else {
            closeModal()
            fetchConfigs()
        }
        setSaving(false)
    }

    async function handleGeneratePuzzle(config: PuzzleConfig) {
        if (!confirm(`Generate puzzle for:\n${config.name}?`)) {
            return
        }

        setGeneratingConfigId(config.id)

        try {
            const response = await fetch('/api/generate-puzzle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId: config.id })
            })

            const result = await response.json()

            if (result.success) {
                alert(
                    `Puzzle generated successfully!\n\n` +
                    `Puzzle ID: ${result.puzzle.id}\n` +
                    `Words placed: ${result.puzzle.totalWords}\n` +
                    `Grid: ${result.puzzle.gridSize}x${result.puzzle.gridSize}\n` +
                    `Density: ${result.puzzle.gridDensity}`
                )
            } else {
                alert(`Puzzle generation failed:\n${result.error}`)
            }
        } catch (error: any) {
            alert(`Error generating puzzle: ${error.message}`)
        } finally {
            setGeneratingConfigId(null)
        }
    }

    if (loading) return <AdminLayout title="Puzzle Configs"><div className="text-gray-400">Loading configs...</div></AdminLayout>

    return (
        <AdminLayout title="Puzzle Configs">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white">Puzzle Configurations</h1>
                    <button
                        onClick={openNewModal}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
                    >
                        + New Config
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <input
                                type="text"
                                placeholder="🔍 Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <select
                                value={filterTheme}
                                onChange={(e) => setFilterTheme(e.target.value)}
                                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                            >
                                <option value="all">All Themes</option>
                                {themes.map(theme => (
                                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <select
                                value={filterLanguage}
                                onChange={(e) => setFilterLanguage(e.target.value)}
                                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                            >
                                <option value="all">All Languages</option>
                                {languages.map(lang => (
                                    <option key={lang.ISO} value={lang.ISO}>{lang.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mb-4 text-sm text-gray-400">
                    Showing {filteredConfigs.length} of {configs.length} configurations
                </div>

                {/* Configs List */}
                <div className="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
                    {filteredConfigs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            {configs.length === 0 ? 'No puzzle configs yet. Click "New Config" to create one.' : 'No configs match your filters.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-700">
                            {filteredConfigs.map((config) => (
                                <div
                                    key={config.id}
                                    className="p-6 hover:bg-gray-700 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => openEditModal(config)}
                                        >
                                            <h3 className="text-lg font-semibold text-white mb-2">
                                                {config.name}
                                            </h3>
                                            <div className="flex items-center gap-4 mb-2 text-sm">
                                                <span className="text-gray-300">🎨 {config.Theme.name}</span>
                                                <span className="text-gray-300">🌍 {config.Language.name}</span>
                                                <span className="text-gray-300">⚡ {config.Difficulty.name}</span>
                                            </div>
                                            <div className="flex gap-4 text-sm text-gray-500">
                                                <span>Grid: {config.grid_size}x{config.grid_size}</span>
                                                <span>Words: {config.number_of_words}</span>
                                            </div>
                                        </div>
                                        <div className="ml-4 flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleGeneratePuzzle(config)
                                                }}
                                                disabled={generatingConfigId === config.id}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {generatingConfigId === config.id ? (
                                                    <>
                                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>🧩 Generate Puzzle</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full border border-gray-700">
                            <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-white">
                                    {editingConfig ? 'Edit Puzzle Config' : 'New Puzzle Config'}
                                </h2>
                                <button
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-white text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Configuration Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                                        placeholder="e.g., Easy Sports 15x15"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Theme *
                                        </label>
                                        <select
                                            required
                                            value={themeId}
                                            onChange={(e) => setThemeId(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                        >
                                            <option value="">Select...</option>
                                            {themes.map(theme => (
                                                <option key={theme.id} value={theme.id}>{theme.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Language *
                                        </label>
                                        <select
                                            required
                                            value={languageId}
                                            onChange={(e) => setLanguageId(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                        >
                                            <option value="">Select...</option>
                                            {languages.map(lang => (
                                                <option key={lang.ISO} value={lang.ISO}>{lang.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Difficulty *
                                        </label>
                                        <select
                                            required
                                            value={difficultyId}
                                            onChange={(e) => setDifficultyId(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                        >
                                            <option value="">Select...</option>
                                            {difficulties.map(diff => (
                                                <option key={diff.id} value={diff.id}>{diff.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Grid Size *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="5"
                                            max="25"
                                            value={gridSize}
                                            onChange={(e) => setGridSize(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                                            placeholder="15"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Square grid (e.g., 15 = 15x15)</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Number of Words *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="10"
                                            max="200"
                                            value={numberOfWords}
                                            onChange={(e) => setNumberOfWords(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                                            placeholder="50"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Target words to place in puzzle</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-6 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                                    >
                                        {saving ? 'Saving...' : editingConfig ? 'Update Config' : 'Create Config'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}