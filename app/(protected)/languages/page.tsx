'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

type Language = {
  ISO: string
  name: string
  order: number | null
  is_active: boolean | null
  created_at: string
}

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  
  // Form fields
  const [iso, setIso] = useState('')
  const [name, setName] = useState('')
  const [order, setOrder] = useState('1')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchLanguages()
  }, [])

  async function fetchLanguages() {
    const { data, error } = await supabase
      .from('Language')
      .select('*')
      .order('order', { ascending: true })
    
    if (error) {
      console.error('Error fetching languages:', error)
    } else {
      setLanguages(data || [])
    }
    setLoading(false)
  }

  const filteredLanguages = languages.filter(language => {
    if (searchTerm && !language.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !language.ISO.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filterActive === 'active' && !language.is_active) return false
    if (filterActive === 'inactive' && language.is_active) return false
    return true
  })

  function openNewModal() {
    setEditingLanguage(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(language: Language) {
    setEditingLanguage(language)
    setIso(language.ISO)
    setName(language.name)
    setOrder(language.order?.toString() || '1')
    setIsActive(language.is_active || false)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingLanguage(null)
    resetForm()
  }

  function resetForm() {
    setIso('')
    setName('')
    setOrder('1')
    setIsActive(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const languageData = {
      ISO: iso.toUpperCase(),
      name,
      order: parseInt(order),
      is_active: isActive
    }

    let error

    if (editingLanguage) {
      const result = await supabase
        .from('Language')
        .update(languageData)
        .eq('ISO', editingLanguage.ISO)
      error = result.error
    } else {
      const result = await supabase
        .from('Language')
        .insert([languageData])
      error = result.error
    }

    if (error) {
      alert(`Error ${editingLanguage ? 'updating' : 'creating'} language: ` + error.message)
    } else {
      closeModal()
      fetchLanguages()
    }
    setSaving(false)
  }

  async function handleSoftDelete() {
    if (!editingLanguage) return
    if (!confirm(`Are you sure you want to deactivate "${editingLanguage.name}"?`)) return

    setSaving(true)
    const { error } = await supabase
      .from('Language')
      .update({ is_active: false })
      .eq('ISO', editingLanguage.ISO)

    if (error) {
      alert('Error deactivating language: ' + error.message)
    } else {
      closeModal()
      fetchLanguages()
    }
    setSaving(false)
  }

  if (loading) return <AdminLayout title="Languages"><div className="text-gray-400">Loading languages...</div></AdminLayout>

  return (
    <AdminLayout title="Languages">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Languages</h1>
          <button
            onClick={openNewModal}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            + New Language
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                placeholder="🔍 Search by name or ISO code..."
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
          Showing {filteredLanguages.length} of {languages.length} languages
        </div>

        {/* Languages List */}
        <div className="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
          {filteredLanguages.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {languages.length === 0 ? 'No languages yet. Click "New Language" to add one.' : 'No languages match your filters.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredLanguages.map((language) => (
                <div
                  key={language.ISO}
                  onClick={() => openEditModal(language)}
                  className="p-6 hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {language.name}
                        </h3>
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded font-mono">
                          {language.ISO}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>Order: {language.order}</span>
                        <span className={language.is_active ? 'text-green-400' : 'text-red-400'}>
                          {language.is_active ? 'Active' : 'Inactive'}
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
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full border border-gray-700">
              <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">
                  {editingLanguage ? 'Edit Language' : 'New Language'}
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
                      ISO Code * <span className="text-xs text-gray-500">(e.g., EN, PT, ES)</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={iso}
                      onChange={(e) => setIso(e.target.value)}
                      disabled={!!editingLanguage}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 disabled:opacity-50 uppercase"
                      placeholder="EN"
                    />
                    {editingLanguage && (
                      <p className="text-xs text-gray-500 mt-1">ISO code cannot be changed</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      value={order}
                      onChange={(e) => setOrder(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="1"
                    />
                  </div>
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
                    placeholder="English"
                  />
                </div>

                <div className="flex items-center">
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

                <div className="flex justify-between gap-3 pt-4 border-t border-gray-700">
                  <div>
                    {editingLanguage && editingLanguage.is_active && (
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
                      {saving ? 'Saving...' : editingLanguage ? 'Update Language' : 'Create Language'}
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
