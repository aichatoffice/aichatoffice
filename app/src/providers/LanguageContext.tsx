import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface LanguageContextType {
  locale: string
  setLocale: (locale: string) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const defaultLocale = navigator.language.split('-')[0] === 'zh' ? 'zh-CN' : 'en-US';
  const [locale, setLocale] = useState<string>(defaultLocale)
  useEffect(() => {
    console.log(locale, 'locale')
  }, [locale])

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}

