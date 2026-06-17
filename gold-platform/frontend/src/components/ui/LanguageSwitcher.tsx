import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { languageNames, type Language } from '../../locales'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const languages: Language[] = ['zh-CN', 'en-US']

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/50 hover:bg-dark-700/50 border border-dark-600/50 transition-all duration-200 text-sm text-[#e0e0ff]"
      >
        <Globe size={16} className="text-cyan-glow" />
        <span>{languageNames[language]}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-dark-800/95 backdrop-blur-md rounded-lg border border-dark-600/50 shadow-xl z-50 py-1">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang)
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                language === lang
                  ? 'bg-cyan-glow/10 text-cyan-glow'
                  : 'text-[#e0e0ff] hover:bg-dark-700/50'
              }`}
            >
              {languageNames[lang]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
