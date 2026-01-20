'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import AdminLayout from '@/app/components/AdminLayout'

type Difficulty = {
  id: string
  name: string
  prompt_name: string | null
  prompt_description: string | null
  distribution_weight: number | null
  order: number | null
  is_active: boolean | null
  created_at: string
}

export default function DifficultiesPage() {
  const [difficulties, setDifficulties] = useState < Difficulty[] > ([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDifficulty, setEditingDifficulty] = useState < Difficulty | null > (null)
  const [saving, setSaving] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState < 'all' | 'active' | 'inactive' > ('all')

  // Form fields
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [promptName, setPromptName] = useState('')
  const [promptDescription, setPromptDescription] = useState('')
  const [distributionWeight, setDistributionWeight] = useState('1.0')
  const [order, setOrder] = useState('1')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchDifficulties()
  }, [])

  async function fetchDifficulties() {
    const { data, error } = await supabase
      .from('Difficulty')
      .select('*')
      .order('order', { ascending: true })

    if (error) {
      console.error('Error fetching difficulties:', error)
    } else {
      setDifficulties(data || [])
    }
    setLoading(false)
  }

  const filteredDifficulties = difficulties.filter(difficulty => {
    if (searchTerm && !difficulty.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !difficulty.id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filterActive === 'active' && !difficulty.is_active) return false
    if (filterActive === 'inactive' && difficulty.is_active) return false
    return true
  })

  function openNewModal() {
    setEditingDifficulty(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(difficulty: Difficulty) {
    setEditingDifficulty(difficulty)
    setId(difficulty.id)
    setName(difficulty.name)
    setPromptName(difficulty.prompt_name || '')
    setPromptDescription(difficulty.prompt_description || '')
    setDistributionWeight(difficulty.distribution_weight?.toString() || '1.0')
    setOrder(difficulty.order?.toString() || '1')
    setIsActive(difficulty.is_active || false)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingDifficulty(null)
    resetForm()
  }

  function resetForm() {
    setId('')
    setName('')
    setPromptName('')
    setPromptDescription('')
    setDistributionWeight('1.0')
    setOrder('1')
    setIsActive(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const difficultyData = {
      id: id.toLowerCase(),
      name,
      prompt_name: promptName || null,
      prompt_description: promptDescription || null,
      distribution_weight: parseFloat(distributionWeight),
      order: parseInt(order),
      is_active: isActive
    }

    let error

    if (editingDifficulty) {
      const result = await supabase
        .from('Difficulty')
        .update(difficultyData)
        .eq('id', editingDifficulty.id)
      error = result.error
    } else {
      const result = await supabase
        .from('Difficulty')
        .insert([difficultyData])
      error = result.error
    }

    if (error) {
      alert(`Error ${editingDifficulty ? 'updating' : 'creating'} difficulty: ` + error.message)
    } else {
      closeModal()
      fetchDifficulties()
    }
    setSaving(false)
  }

  async function handleSoftDelete() {
    if (!editingDifficulty) return
    if (!confirm(`Are you sure you want to deactivate "${editingDifficulty.name}"?`)) return

    setSaving(true)
    const { error } = await supabase
      .from('Difficulty')
      .update({ is_active: false })
      .eq('id', editingDifficulty.id)

    if (error) {
      alert('Error deactivating difficulty: ' + error.message)
    } else {
      closeModal()
      fetchDifficulties()
    }
    setSaving(false)
  }

  if (loading) return <AdminLayout title="Difficulties"><div className="text-gray-400">Loading difficulties...</div></AdminLayout>

  return (
    <AdminLayout title="Difficulties">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Difficulties</h1>
          <button
            onClick={openNewModal}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            + New Difficulty
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                placeholder="🔍 Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as any)}
                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredDifficulties.length} of {difficulties.length} difficulties
        </div>

        {/* Difficulties List */}
        <div className="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
          {filteredDifficulties.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {difficulties.length === 0 ? 'No difficulties yet. Click "New Difficulty" to add one.' : 'No difficulties match your filters.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredDifficulties.map((difficulty) => (
                <div
                  key={difficulty.id}
                  onClick={() => openEditModal(difficulty)}
                  className="p-6 hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {difficulty.name}
                        </h3>
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded font-mono">
                          {difficulty.id}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">
                        {difficulty.prompt_description || 'No description'}
                      </p>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>Weight: {difficulty.distribution_weight}</span>
                        <span>Order: {difficulty.order}</span>
                        <span className={difficulty.is_active ? 'text-green-400' : 'text-red-400'}>
                          {difficulty.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-600 ml-4">→</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">
                  {editingDifficulty ? 'Edit Difficulty' : 'New Difficulty'}
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
                      ID * <span className="text-xs text-gray-500">(e.g., easy, medium, hard)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      disabled={!!editingDifficulty}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 disabled:opacity-50 lowercase"
                      placeholder="easy"
                    />
                    {editingDifficulty && (
                      <p className="text-xs text-gray-500 mt-1">ID cannot be changed</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="Easy"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Prompt Name
                    </label>
                    <input
                      type="text"
                      value={promptName}
                      onChange={(e) => setPromptName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="Beginner-Friendly"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Distribution Weight
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={distributionWeight}
                      onChange={(e) => setDistributionWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Prompt Description
                  </label>
                  <textarea
                    value={promptDescription}
                    onChange={(e) => setPromptDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    rows={3}
                    placeholder="Simple, everyday words suitable for beginners..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      value = { order }
                      onChange = {(e) => setOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    placeholder="1"
                    />
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
                    {editingDifficulty && editingDifficulty.is_active && (
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
                      {saving ? 'Saving...' : editingDifficulty ? 'Update Difficulty' : 'Create Difficulty'}
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
