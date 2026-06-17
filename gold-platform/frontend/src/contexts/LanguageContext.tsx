import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { locales, type Language, defaultLanguage, type Locale } from '../locales'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Locale
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language | null
    if (saved && saved in locales) {
      return saved
    }
    const browserLang = navigator.language.slice(0, 5) as Language
    if (browserLang in locales) {
      return browserLang
    }
    return defaultLanguage
  })

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  const setLanguage = useCallback((lang: Language) => {
    if (lang in locales) {
      setLanguageState(lang)
    }
  }, [])

  const t = locales[language]

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export function useTranslation() {
  const { t } = useLanguage()
  return t
}
