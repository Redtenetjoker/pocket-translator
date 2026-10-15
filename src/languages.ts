export interface Lang {
  code: string // BCP-47，用于 STT/TTS
  name: string // 中文名
  native: string // 本地名
  flag: string
  mm: string // MyMemory langpair 代码
}

export const LANGUAGES: Lang[] = [
  { code: 'zh-CN', name: '中文（简体）', native: '简体中文', flag: '🇨🇳', mm: 'zh-CN' },
  { code: 'zh-TW', name: '中文（繁体）', native: '繁體中文', flag: '🇹🇼', mm: 'zh-TW' },
  { code: 'en-US', name: '英语（美国）', native: 'English', flag: '🇺🇸', mm: 'en-GB' },
  { code: 'ja-JP', name: '日语', native: '日本語', flag: '🇯🇵', mm: 'ja-JP' },
  { code: 'ko-KR', name: '韩语', native: '한국어', flag: '🇰🇷', mm: 'ko-KR' },
  { code: 'fr-FR', name: '法语', native: 'Français', flag: '🇫🇷', mm: 'fr-FR' },
  { code: 'de-DE', name: '德语', native: 'Deutsch', flag: '🇩🇪', mm: 'de-DE' },
  { code: 'es-ES', name: '西班牙语', native: 'Español', flag: '🇪🇸', mm: 'es-ES' },
  { code: 'ru-RU', name: '俄语', native: 'Русский', flag: '🇷🇺', mm: 'ru-RU' },
  { code: 'th-TH', name: '泰语', native: 'ไทย', flag: '🇹🇭', mm: 'th-TH' },
  { code: 'vi-VN', name: '越南语', native: 'Tiếng Việt', flag: '🇻🇳', mm: 'vi-VN' },
  { code: 'it-IT', name: '意大利语', native: 'Italiano', flag: '🇮🇹', mm: 'it-IT' },
  { code: 'pt-BR', name: '葡萄牙语（巴西）', native: 'Português', flag: '🇧🇷', mm: 'pt-PT' },
  { code: 'ar-SA', name: '阿拉伯语', native: 'العربية', flag: '🇸🇦', mm: 'ar-SA' },
  { code: 'hi-IN', name: '印地语', native: 'हिन्दी', flag: '🇮🇳', mm: 'hi-IN' },
  { code: 'id-ID', name: '印尼语', native: 'Indonesia', flag: '🇮🇩', mm: 'id-ID' },
]

export const langByCode = (code: string): Lang =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
