import { useCallback, useEffect, useRef, useState } from 'react'
import { SpeechListener } from './stt'
import { keepAwake, primeTts, speak, stopSpeaking } from './tts'
import { translate } from './translate'
import { appendHistory, loadHistory, loadSettings, saveSettings, type HistoryItem, type Settings } from './store'
import { langByCode } from './languages'
import HomePage from './components/HomePage'
import FaceToFacePage from './components/FaceToFacePage'
import AmbientPage from './components/AmbientPage'
import MeetingPage from './components/MeetingPage'
import CallModePage from './components/CallModePage'
import SettingsPage from './components/SettingsPage'

export type Route = 'home' | 'facetoface' | 'ambient' | 'meeting' | 'call' | 'settings'

export interface Turn {
  id: number
  side: 'me' | 'other'
  original: string
  translated: string
  error?: boolean
}

let turnSeq = 1

export default function App() {
  const [route, setRoute] = useState<Route>('home')
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [toast, setToast] = useState('')

  useEffect(() => saveSettings(settings), [settings])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 2600)
  }, [])

  const patch = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), [])

  return (
    <div className="app">
      {route === 'home' && (
        <HomePage
          settings={settings}
          history={history}
          onClearHistory={() => {
            localStorage.removeItem('kd.history.v1')
            setHistory([])
          }}
          onGo={setRoute}
        />
      )}
      {route === 'facetoface' && (
        <FaceToFacePage
          settings={settings}
          patch={patch}
          onBack={() => setRoute('home')}
          showToast={showToast}
          onTurn={(original, translated, from, to) => {
            appendHistory({ time: Date.now(), from, to, original, translated })
            setHistory(loadHistory())
          }}
        />
      )}
      {route === 'ambient' && (
        <AmbientPage
          settings={settings}
          patch={patch}
          onBack={() => setRoute('home')}
          showToast={showToast}
          onTurn={(original, translated, from, to) => {
            appendHistory({ time: Date.now(), from, to, original, translated })
            setHistory(loadHistory())
          }}
        />
      )}
      {route === 'meeting' && (
        <MeetingPage settings={settings} patch={patch} onBack={() => setRoute('home')} showToast={showToast} />
      )}
      {route === 'call' && (
        <CallModePage
          settings={settings}
          patch={patch}
          onBack={() => setRoute('home')}
          showToast={showToast}
          onTurn={(original, translated, from, to) => {
            appendHistory({ time: Date.now(), from, to, original, translated })
            setHistory(loadHistory())
          }}
        />
      )}
      {route === 'settings' && (
        <SettingsPage settings={settings} patch={patch} onBack={() => setRoute('home')} showToast={showToast} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ============ 供两个翻译页复用的会话引擎 ============ */

export function useTranslator(opts: {
  settings: Settings
  showToast: (m: string) => void
  onTurn: (original: string, translated: string, from: string, to: string) => void
}) {
  const { settings, showToast, onTurn } = opts
  const [turns, setTurns] = useState<Turn[]>([])
  const [partial, setPartial] = useState('')
  const [busyTranslating, setBusyTranslating] = useState(false)
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const listenerRef = useRef<SpeechListener | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const onTurnRef = useRef(onTurn)
  onTurnRef.current = onTurn
  // 当前说话方（STT 回调归属用），由页面切换
  const sideRef = useRef<'me' | 'other'>('other')

  useEffect(() => {
    const l = new SpeechListener({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => {
        setPartial('')
        void handleFinalRef.current(t, sideRef.current)
      },
      onError: (m) => showToast(m),
    })
    listenerRef.current = l
    return () => {
      l.stop()
      stopSpeaking()
      void keepAwake(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFinal = useCallback(
    async (text: string, sideOverride?: 'me' | 'other', fromOverride?: string, toOverride?: string) => {
      const s = settingsRef.current
      const side = sideOverride ?? sideRef.current
      const from = fromOverride ?? (side === 'me' ? s.myLang : s.otherLang)
      const to = toOverride ?? (side === 'me' ? s.otherLang : s.myLang)
      const id = turnSeq++
      setTurns((list) => [...list, { id, side, original: text, translated: '…' }])
      setBusyTranslating(true)
      try {
        let out = await translate(text, from, to, s.provider, s.llm, s.glossary)
        // 免费通道方向错误时会原样返回：反向重试一次
        if (
          out.trim().toLowerCase() === text.trim().toLowerCase() &&
          from !== to &&
          fromOverride === undefined
        ) {
          const retry = await translate(text, to, from, s.provider, s.llm, s.glossary)
          if (retry.trim().toLowerCase() !== text.trim().toLowerCase()) out = retry
        }
        setTurns((list) => list.map((t) => (t.id === id ? { ...t, translated: out } : t)))
        onTurnRef.current(text, out, from, to)
        if (s.autoSpeak) {
          speak(out, to, {
            rate: s.speakRate,
            onStart: () => setSpeakingId(id),
            onEnd: () => setSpeakingId(null),
          })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setTurns((list) => list.map((t) => (t.id === id ? { ...t, translated: '翻译失败：' + msg, error: true } : t)))
        showToast('翻译失败：' + msg)
      } finally {
        setBusyTranslating(false)
      }
    },
    [],
  )

  const handleFinalRef = useRef(handleFinal)
  handleFinalRef.current = handleFinal

  const startListening = useCallback((side: 'me' | 'other') => {
    const s = settingsRef.current
    sideRef.current = side
    primeTts() // 在用户手势链里激活 TTS（iOS 必需）
    if (s.keepScreenOn) void keepAwake(true)
    listenerRef.current?.setLang(side === 'me' ? s.myLang : s.otherLang)
    listenerRef.current?.start(side === 'me' ? s.myLang : s.otherLang)
  }, [])

  const stopListening = useCallback(() => {
    listenerRef.current?.stop()
    setPartial('')
    void keepAwake(false)
  }, [])

  const replay = useCallback((t: Turn) => {
    const s = settingsRef.current
    const to = t.side === 'me' ? s.otherLang : s.myLang
    speak(t.translated, to, { rate: s.speakRate })
  }, [])

  return {
    turns,
    partial,
    busyTranslating,
    speakingId,
    handleFinal,
    startListening,
    stopListening,
    replay,
    listener: listenerRef,
    setSide: (s: 'me' | 'other') => {
      sideRef.current = s
    },
  }
}

/** 打字输入的语言方向自动检测：一方是中日韩、另一方不是时，按文字是否含 CJK 判定 */
export function detectTypedDirection(
  text: string,
  myLang: string,
  otherLang: string,
): { from: string; to: string; side: 'me' | 'other' } | null {
  const cjkLangs = ['zh-CN', 'zh-TW', 'ja-JP', 'ko-KR']
  const aCjk = cjkLangs.includes(myLang)
  const bCjk = cjkLangs.includes(otherLang)
  if (aCjk === bCjk) return null // 双方同类文字，无法判断
  const hasCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text)
  if (hasCjk === aCjk) return { from: myLang, to: otherLang, side: 'me' }
  return { from: otherLang, to: myLang, side: 'other' }
}

export function timeLabel(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function langLabel(code: string): string {
  const l = langByCode(code)
  return `${l.flag} ${l.native}`
}
