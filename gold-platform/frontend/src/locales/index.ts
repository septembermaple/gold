export type Language = 'zh-CN' | 'en-US'

export interface Locale {
  common: Record<string, string>
  home: Record<string, any>
  login: Record<string, string>
  register: Record<string, string>
  signals: Record<string, string>
  sentiment: Record<string, string>
  risk: Record<string, string>
  ai_analysis: Record<string, string>
  ai_analysis_page: Record<string, any>
  institution: Record<string, string>
  institution_views: Record<string, string>
  investment: Record<string, any>
  investment_advice_page: Record<string, string>
  macro: Record<string, string>
  macro_page: Record<string, string>
  profile: Record<string, string>
  profile_page: Record<string, string>
  dashboard: Record<string, string>
  admin: Record<string, any>
  analysis: Record<string, string>
  scoring: Record<string, any>
  sentiment_page: Record<string, any>
  [key: string]: any
}

import { zhCN } from './zh-CN'
import { enUS } from './en-US'

export const locales: Record<Language, Locale> = {
  'zh-CN': zhCN as unknown as Locale,
  'en-US': enUS as unknown as Locale,
}

export const defaultLanguage: Language = 'zh-CN'

export const languageNames: Record<Language, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
}
