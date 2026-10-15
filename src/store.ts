/* 本机状态：设置 + 历史（localStorage） */
import type { LlmConfig, ProviderKind } from './translate'

export interface Settings {
  provider: ProviderKind
  llm: LlmConfig
  myLang: string // “我”的语言
  otherLang: string // “对方”的语言
  autoSpeak: boolean
  speakRate: number
  keepScreenOn: boolean
}

export interface HistoryItem {
  time: number
  from: string
  to: string
  original: string
  translated: string
}

const SETTINGS_KEY = 'kd.settings.v1'
const HISTORY_KEY = 'kd.history.v1'

export const defaultSettings: Settings = {
  provider: 'free',
  llm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: '', model: 'glm-4-flash' },
  myLang: 'zh-CN',
  otherLang: 'en-US',
  autoSpeak: true,
  speakRate: 1,
  keepScreenOn: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryItem[]
  } catch {
    return []
  }
}

export function appendHistory(item: HistoryItem) {
  const list = loadHistory()
  list.unshift(item)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 500)))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
