'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '../components/AdminLayout'
import * as XLSX from 'xlsx'

type Theme = {
  id: number
  name: string
  description: string | null
  target_word_count: number | null
  is_generic_builder: boolean | null
  system_instructions: string | null
  user_prompt: string | null
  priority: number | null
  is_active: boolean | null
  created_at: string
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [saving, setSaving] = useState(false)
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterGeneric, setFilterGeneric] = useState<'all' | 'generic' | 'non-generic'>('all')


  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetWordCount, setTargetWordCount] = useState('600')
  const [isGenericBuilder, setIsGenericBuilder] = useState(true)
  const [systemInstructions, setSystemInstructions] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [priority, setPriority] = useState('10')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchThemes()
  }, [])

  async function fetchThemes() {
    const { data, error } = await supabase
      .from('Theme')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching themes:', error)
    } else {
      setThemes(data || [])
    }
    setLoading(false)
  }

  const filteredThemes = themes.filter(theme => {
    if (searchTerm && !theme.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (filterActive === 'active' && !theme.is_active) return false
    if (filterActive === 'inactive' && theme.is_active) return false
    if (filterGeneric === 'generic' && !theme.is_generic_builder) return false
    if (filterGeneric === 'non-generic' && theme.is_generic_builder) return false
    return true
  })

  function openNewModal() {
    setEditingTheme(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(theme: Theme) {
    setEditingTheme(theme)
    setName(theme.name)
    setDescription(theme.description || '')
    setTargetWordCount(theme.target_word_count?.toString() || '600')
    setIsGenericBuilder(theme.is_generic_builder || false)
    setSystemInstructions(theme.system_instructions || '')
    setUserPrompt(theme.user_prompt || '')
    setPriority(theme.priority?.toString() || '10')
    setIsActive(theme.is_active || false)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingTheme(null)
    resetForm()
  }

  function resetForm() {
    setName('')
    setDescription('')
    setTargetWordCount('600')
    setIsGenericBuilder(true)
    setSystemInstructions('')
    setUserPrompt('')
    setPriority('10')
    setIsActive(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const themeData = {
      name,
      description: description || null,
      target_word_count: parseInt(targetWordCount),
      is_generic_builder: isGenericBuilder,
      system_instructions: systemInstructions || null,
      user_prompt: userPrompt || null,
      priority: parseInt(priority),
      is_active: isActive
    }

    let error

    if (editingTheme) {
      const result = await supabase
        .from('Theme')
        .update(themeData)
        .eq('id', editingTheme.id)
      error = result.error
    } else {
      const result = await supabase
        .from('Theme')
        .insert([themeData])
      error = result.error
    }

    if (error) {
      alert(`Error ${editingTheme ? 'updating' : 'creating'} theme: ` + error.message)
    } else {
      closeModal()
      fetchThemes()
    }
    setSaving(false)
  }

  async function handleSoftDelete() {
    if (!editingTheme) return
    if (!confirm(`Are you sure you want to deactivate "${editingTheme.name}"?`)) return

    setSaving(true)
    const { error } = await supabase
      .from('Theme')
      .update({ is_active: false })
      .eq('id', editingTheme.id)

    if (error) {
      alert('Error deactivating theme: ' + error.message)
    } else {
      closeModal()
      fetchThemes()
    }
    setSaving(false)
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        // Get existing theme names
        const { data: existingThemes } = await supabase.from('Theme').select('name')
        const existingNames = new Set(existingThemes?.map(t => t.name) || [])

        // Filter out existing themes
        const newThemes = jsonData
          .map((row: any) => ({
            name: row['Name'],
            description: row['Description'] || null,
            target_word_count: parseInt(row['Target Word Count']) || null,
            is_generic_builder: row['Is Generic'] === 1 || row['Is Generic'] === '1' || row['Is Generic'] === true,
            system_instructions: row['System Instruction'] || null,
            user_prompt: row['User Prompt Template'] || null,
            priority: parseInt(row['Priority']) || 10,
            is_active: true
          }))
          .filter(theme => !existingNames.has(theme.name))

        if (newThemes.length === 0) {
          alert('No new themes to import. All themes already exist.')
          return
        }

        const { error } = await supabase.from('Theme').insert(newThemes)

        if (error) {
          alert('Error importing themes: ' + error.message)
        } else {
          const skipped = jsonData.length - newThemes.length
          alert(`Successfully imported ${newThemes.length} theme(s)!` +
            (skipped > 0 ? `\n${skipped} theme(s) skipped (already exist).` : ''))
          fetchThemes()
        }
      } catch (error) {
        alert('Error parsing file: ' + error)
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function handleHarvest(theme: Theme) {
    if (!confirm(`Create harvest jobs for "${theme.name}"?\n\nThis will create jobs for all active languages and difficulties.`)) {
      return
    }

    try {
      // Get all active languages
      const { data: languages, error: langError } = await supabase
        .from('Language')
        .select('ISO')
        .eq('is_active', true)

      if (langError) throw langError

      // Get all active difficulties
      const { data: difficulties, error: diffError } = await supabase
        .from('Difficulty')
        .select('id')
        .eq('is_active', true)

      if (diffError) throw diffError

      if (!languages?.length || !difficulties?.length) {
        alert('No active languages or difficulties found. Please activate some first.')
        return
      }

      // Create harvest jobs for each combination
      const jobs = []
      for (const language of languages) {
        for (const difficulty of difficulties) {
          jobs.push({
            theme_id: theme.id,
            language_id: language.ISO,
            difficulty_id: difficulty.id,
            status_id: 'Pending'
          })
        }
      }

      const { error: insertError } = await supabase
        .from('HarvestJob')
        .insert(jobs)

      if (insertError) throw insertError

      alert(`Successfully created ${jobs.length} harvest job(s)!\n${languages.length} languages × ${difficulties.length} difficulties`)
    } catch (error: any) {
      alert('Error creating harvest jobs: ' + error.message)
    }
  }

  if (loading) return <AdminLayout title="Themes"><div className="text-gray-400">Loading themes...</div></AdminLayout>

  return (
    <AdminLayout title="Themes">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Themes</h1>
          <div className="flex gap-3">
            <label className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-600 font-medium cursor-pointer">
              📥 Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
            <button
              onClick={openNewModal}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              + New Theme
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="🔍 Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)} className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <div>
              <select value={filterGeneric} onChange={(e) => setFilterGeneric(e.target.value as any)} className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Types</option>
                <option value="generic">Generic Only</option>
                <option value="non-generic">Non-Generic Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredThemes.length} of {themes.length} themes
        </div>

        {/* Themes List */}
        <div className="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
          {themes.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No themes yet. Click "New Theme" to create one.
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredThemes.map((theme) => (
                <div
                  key={theme.id}
                  className="p-6 hover:bg-gray-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => openEditModal(theme)}
                    >
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {theme.name}
                      </h3>
                      <p className="text-sm text-gray-400 mb-3">
                        {theme.description || 'No description'}
                      </p>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>TWC: {theme.target_word_count}</span>
                        <span>Priority: {theme.priority}</span>
                        {theme.is_generic_builder && <span className="text-blue-400">Generic Builder</span>}
                        <span className={theme.is_active ? 'text-green-400' : 'text-red-400'}>
                          {theme.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {theme.is_active && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleHarvest(theme)
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                          title="Create harvest jobs for all active languages and difficulties"
                        >
                          🌾 Harvest
                        </button>
                      )}
                      <div
                        className="text-gray-600 cursor-pointer"
                        onClick={() => openEditModal(theme)}
                      >
                        →
                      </div>
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
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">
                  {editingTheme ? 'Edit Theme' : 'New Theme'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Name * <span className="text-xs text-gray-500">(must be unique)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="e.g., Common - Verbs"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Target Word Count
                    </label>
                    <input
                      type="number"
                      value={targetWordCount}
                      onChange={(e) => setTargetWordCount(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    rows={2}
                    placeholder="High-frequency verbs (infinitives and basic conjugations)..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    AI System Instructions
                  </label>
                  <textarea
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    rows={2}
                    placeholder="You are a Linguistic Expert specializing in..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    AI User Prompt Template
                  </label>
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    rows={4}
                    placeholder="Generate a JSON list of {{NUMBER_OF_WORDS}}..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    />
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGenericBuilder}
                        onChange={(e) => setIsGenericBuilder(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-300">Generic Builder</span>
                    </label>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-300">Active</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t border-gray-700">
                  <div>
                    {editingTheme && editingTheme.is_active && (
                      <button
                        type="button"
                        onClick={handleSoftDelete}
                        disabled={saving}
                        className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={closeModal} className="px-6 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                      {saving ? 'Saving...' : editingTheme ? 'Update Theme' : 'Create Theme'}
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
