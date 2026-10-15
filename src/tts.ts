/* 语音合成封装 —— iOS Safari 兼容要点：
 * - 首次必须由用户手势触发一次 speak（哪怕空文本），否则后续异步回调里的 speak 无声
 * - 声音列表异步加载（voiceschanged）
 * - 按语言前缀挑选最优声音
 */
let primed = false

export function primeTts() {
  if (primed) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
    primed = true
  } catch {
    /* ignore */
  }
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  const base = lang.split('-')[0].toLowerCase()
  // 精确匹配 → 语言前缀匹配 → 增强型声音优先
  let v = voices.find((x) => x.lang.toLowerCase() === lang.toLowerCase())
  if (!v) v = voices.find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(base))
  if (!v) v = voices.find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(base) && /enhanced|premium|natural/i.test(x.name))
  return v ?? null
}

export function speak(
  text: string,
  lang: string,
  opts: { rate?: number; onEnd?: () => void; onStart?: () => void } = {},
) {
  if (!text.trim()) return
  primeTts()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const v = pickVoice(lang)
  if (v) u.voice = v
  u.rate = opts.rate ?? 1
  u.pitch = 1
  u.onstart = () => opts.onStart?.()
  u.onend = () => opts.onEnd?.()
  u.onerror = () => opts.onEnd?.()
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  try {
    speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

export function ttsVoiceName(lang: string): string | null {
  return pickVoice(lang)?.name ?? null
}

/** 静音期间保持屏幕常亮（iOS 16.4+ Safari 支持 Wake Lock） */
export async function keepAwake(on: boolean): Promise<void> {
  const nav = navigator as any
  if (!nav.wakeLock) return
  try {
    if (on && !(nav as any)._wakeLockSentinel) {
      ;(nav as any)._wakeLockSentinel = await nav.wakeLock.request('screen')
    } else if (!on && (nav as any)._wakeLockSentinel) {
      await (nav as any)._wakeLockSentinel.release()
      ;(nav as any)._wakeLockSentinel = null
    }
  } catch {
    /* ignore */
  }
}
