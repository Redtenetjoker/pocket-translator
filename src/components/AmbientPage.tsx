import { useEffect, useRef, useState } from 'react'
import { useTranslator, langLabel } from '../App'
import type { Settings } from '../store'
import { keepAwake, stopSpeaking } from '../tts'
import { SpeechListener } from '../stt'
import LanguagePicker from './LanguagePicker'

export default function AmbientPage(props: {
  settings: Settings
  patch: (p: Partial<Settings>) => void
  onBack: () => void
  showToast: (m: string) => void
  onTurn: (original: string, translated: string, from: string, to: string) => void
}) {
  const { settings, patch } = props
  const [running, setRunning] = useState(false)
  const [pickLang, setPickLang] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const t = useTranslator({ settings, showToast: props.showToast, onTurn: props.onTurn })

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [t.turns, t.partial])

  useEffect(
    () => () => {
      t.stopListening()
      stopSpeaking()
      void keepAwake(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const toggle = () => {
    if (running) {
      t.stopListening()
      stopSpeaking()
      setRunning(false)
    } else {
      // 倾听对方语言 → 译成我的语言
      t.setSide('other')
      t.startListening('other')
      setRunning(true)
    }
  }

  return (
    <div className="page ambient">
      <header className="bar">
        <button className="icon-btn" onClick={props.onBack} aria-label="返回">
          ‹
        </button>
        <div className="lang-pair">
          <span className="bar-title">倾听模式</span>
        </div>
        <button className="icon-btn" aria-label="语言" onClick={() => setPickLang(true)}>
          🌐
        </button>
      </header>

      <div className="ambient-langs" onClick={() => setPickLang(true)}>
        听 <b>{langLabel(settings.otherLang)}</b> → 译成 <b>{langLabel(settings.myLang)}</b>
        （点按可修改）
      </div>

      <div className="status-row">
        {running ? (
          <span className={`status live ${t.partial ? 'hearing' : ''}`}>
            🎧 正在倾听{t.partial ? `“${t.partial}”` : '…'}
          </span>
        ) : (
          <span className="status idle">点击开始，放在两人之间即可</span>
        )}
        {t.busyTranslating && <span className="status busy">翻译中…</span>}
      </div>

      <div className="transcript" ref={scroller}>
        {t.turns.length === 0 && (
          <div className="empty big">
            持续收听周围的外语对话，
            <br />
            每句自动翻译{settings.autoSpeak ? '并朗读' : ''}。
          </div>
        )}
        {t.turns.map((turn) => (
          <div key={turn.id} className="bubble-row theirs">
            <div className={`bubble ${turn.error ? 'err' : ''} ${t.speakingId === turn.id ? 'speaking' : ''}`}>
              <div className="bubble-original">{turn.original}</div>
              <div className="bubble-translated">{turn.translated}</div>
            </div>
            <button className="replay" aria-label="重听" onClick={() => t.replay(turn)}>
              ↻
            </button>
          </div>
        ))}
      </div>

      <footer className="ambient-controls">
        <button className={`listen-btn ${running ? 'active' : ''}`} onClick={toggle} disabled={!SpeechListener.supported}>
          {running ? '■ 停止倾听' : '🎧 开始倾听'}
        </button>
      </footer>

      {pickLang && (
        <LanguagePicker
          title="要听的语言"
          current={settings.otherLang}
          onPick={(code) => {
            patch({ otherLang: code })
            if (running) {
              t.stopListening()
              t.startListening('other')
            }
          }}
          onClose={() => setPickLang(false)}
        />
      )}
    </div>
  )
}
