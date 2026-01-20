'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type LanguageContextType = {
  selectedLanguage: string
  setSelectedLanguage: (lang: string) => void
  availableLanguages: { ISO: string; name: string; flag_emoji: string }[]
  setAvailableLanguages: (langs: { ISO: string; name: string; flag_emoji: string }[]) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [selectedLanguage, setSelectedLanguageState] = useState<string>('PT-PT')
  const [availableLanguages, setAvailableLanguages] = useState<{ ISO: string; name: string; flag_emoji: string }[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedLanguage')
    if (saved) {
      setSelectedLanguageState(saved)
    }
  }, [])

  // Save to localStorage when changed
  const setSelectedLanguage = (lang: string) => {
    setSelectedLanguageState(lang)
    localStorage.setItem('selectedLanguage', lang)
  }

  return (
    <LanguageContext.Provider value={{ 
      selectedLanguage, 
      setSelectedLanguage,
      availableLanguages,
      setAvailableLanguages
    }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
