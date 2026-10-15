/* 语音识别封装 —— Safari/Chrome Web Speech API，带 iOS 兼容处理：
 * - iOS Safari 的 continuous 不可靠：用 continuous=false + 自动重启循环
 * - 每次识别结束（onend）若会话仍激活则自动重启
 * - no-speech / aborted 视为正常轮转；not-allowed 上报权限问题
 */
export interface SttHandlers {
  onPartial?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (message: string) => void
  onStateChange?: (listening: boolean) => void
}

type AnySR = any

export class SpeechListener {
  private rec: AnySR | null = null
  private active = false
  private restartTimer: number | null = null
  private lang = 'zh-CN'
  private handlers: SttHandlers = {}
  private lastFinalAt = 0
  private restarts = 0

  constructor(handlers: SttHandlers) {
    this.handlers = handlers
  }

  static get supported(): boolean {
    const w = window as any
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
  }

  setLang(lang: string) {
    this.lang = lang
    if (this.rec) this.rec.lang = lang
  }

  get listening() {
    return this.active
  }

  start(lang?: string) {
    if (lang) this.lang = lang
    if (this.active) return
    this.active = true
    this.restarts = 0
    this.spin()
  }

  stop() {
    this.active = false
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.rec) {
      try {
        this.rec.onend = null
        this.rec.onresult = null
        this.rec.onerror = null
        this.rec.stop()
      } catch {
        /* 忽略 */
      }
      this.rec = null
    }
    this.handlers.onStateChange?.(false)
  }

  private spin() {
    if (!this.active) return
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      this.active = false
      this.handlers.onError?.('此浏览器不支持语音识别，请使用 iPhone Safari 或 Chrome')
      return
    }
    const rec: AnySR = new SR()
    this.rec = rec
    rec.lang = this.lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) {
          const text = String(r[0].transcript || '').trim()
          if (text) {
            this.lastFinalAt = Date.now()
            this.handlers.onFinal?.(text)
          }
        } else {
          interim += r[0].transcript
        }
      }
      if (interim.trim()) this.handlers.onPartial?.(interim.trim())
    }

    rec.onerror = (event: any) => {
      const err = String(event?.error ?? 'unknown')
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.active = false
        this.handlers.onError?.('麦克风权限被拒绝，请在系统设置中允许此网站使用麦克风')
      } else if (err === 'network') {
        this.handlers.onError?.('网络异常，语音识别需要联网（或稍后重试）')
      }
      // no-speech / aborted / audio-capture：静默轮转
    }

    rec.onend = () => {
      if (!this.active) return
      // 连续无结果重启保护：最多连续 60 次
      if (Date.now() - this.lastFinalAt > 300000) this.restarts++
      if (this.restarts > 300) {
        this.active = false
        this.handlers.onError?.('识别会话已超时，请重新点击开始')
        return
      }
      const delay = Date.now() - this.lastFinalAt < 1500 ? 250 : 60
      this.restartTimer = window.setTimeout(() => this.spin(), delay)
    }

    try {
      rec.start()
      this.handlers.onStateChange?.(true)
    } catch {
      // start() 在未结束时抛异常 → 稍后重试
      this.restartTimer = window.setTimeout(() => this.spin(), 400)
    }
  }
}
