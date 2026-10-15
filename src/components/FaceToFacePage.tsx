import { useEffect, useRef, useState } from 'react'
import { useTranslator, langLabel, type Turn } from '../App'
import type { Settings } from '../store'
import { stopSpeaking } from '../tts'
import { SpeechListener } from '../stt'
import { langByCode } from '../languages'
import LanguagePicker from './LanguagePicker'

export default function FaceToFacePage(props: {
  settings: Settings
  patch: (p: Partial<Settings>) => void
  onBack: () => void
  showToast: (m: string) => void
  onTurn: (original: string, translated: string, from: string, to: string) => void
}) {
  const { settings, patch } = props
  const [side, setSide] = useState<'me' | 'other' | null>(null)
  const [bigText, setBigText] = useState<Turn | null>(null)
  const [pickLang, setPickLang] = useState<'myLang' | 'otherLang' | null>(null)
  const [typed, setTyped] = useState('')
  const [showType, setShowType] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const t = useTranslator({ settings, showToast: props.showToast, onTurn: props.onTurn })

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [t.turns, t.partial])

  // stt 回调需要知道当前 side：用自定义监听器重建过于复杂，改为在 startListening 里闭包捕获
  const startSide = (s: 'me' | 'other') => {
    if (side === s) {
      // 再点一次 = 停止
      t.stopListening()
      setSide(null)
      return
    }
    const wasRunning = side !== null
    if (wasRunning) t.stopListening()
    setSide(s)
    t.startListening(s)
  }

  const stopAll = () => {
    t.stopListening()
    stopSpeaking()
    setSide(null)
  }

  useEffect(() => stopAll, []) // 离开页面清理

  const submitTyped = () => {
    const text = typed.trim()
    if (!text) return
    setTyped('')
    void t.handleFinal(text, side ?? 'me')
  }

  const lastTranslated = [...t.turns].reverse().find((x) => !x.error)

  return (
    <div className="page f2f">
      <header className="bar">
        <button className="icon-btn" onClick={props.onBack} aria-label="返回">
          ‹
        </button>
        <div className="lang-pair">
          <button className="lang-chip" onClick={() => setPickLang('myLang')}>
            {langLabel(settings.myLang)}
          </button>
          <button
            className="swap"
            aria-label="交换语言"
            onClick={() => patch({ myLang: settings.otherLang, otherLang: settings.myLang })}
          >
            ⇄
          </button>
          <button className="lang-chip" onClick={() => setPickLang('otherLang')}>
            {langLabel(settings.otherLang)}
          </button>
        </div>
        <button
          className={'icon-btn' + (bigText ? ' on' : '')}
          aria-label="大字展示"
          onClick={() => setBigText(lastTranslated ?? null)}
        >
          Aa
        </button>
      </header>

      <div className="status-row">
        {side === null && <span className="status idle">点击下方按钮开始</span>}
        {side === 'me' && (
          <span className={`status live ${t.partial ? 'hearing' : ''}`}>
            🎤 正在听我说{t.partial ? `“${t.partial}”` : '…'}
          </span>
        )}
        {side === 'other' && (
          <span className={`status live ${t.partial ? 'hearing' : ''}`}>
            🎤 正在听对方{t.partial ? `“${t.partial}”` : '…'}
          </span>
        )}
        {t.busyTranslating && <span className="status busy">翻译中…</span>}
      </div>

      <div className="transcript" ref={scroller}>
        {t.turns.length === 0 && (
          <div className="empty big">
            点「我说」或「对方说」，说完一句会自动翻译并朗读；
            <br />
            说话时尽量离手机/耳机近一点。
          </div>
        )}
        {t.turns.map((turn) => (
          <div key={turn.id} className={`bubble-row ${turn.side === 'me' ? 'mine' : 'theirs'}`}>
            <div className={`bubble ${turn.error ? 'err' : ''} ${t.speakingId === turn.id ? 'speaking' : ''}`}>
              <div className="bubble-original">{turn.original}</div>
              <div className="bubble-translated" onClick={() => setBigText(turn)}>
                {turn.translated}
              </div>
            </div>
            <button className="replay" aria-label="重听" onClick={() => t.replay(turn)}>
              ↻
            </button>
          </div>
        ))}
      </div>

      {showType && (
        <div className="type-bar">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
            placeholder="不方便说话？打字也能翻译"
            autoFocus
          />
          <button className="small-btn" onClick={submitTyped}>
            译
          </button>
        </div>
      )}

      <footer className="f2f-controls">
        <button
          className={`talk-btn me ${side === 'me' ? 'active' : ''}`}
          onClick={() => startSide('me')}
          disabled={!SpeechListener.supported}
        >
          <span className="talk-icon">{langByCode(settings.myLang).flag}</span>
          <span>我说 · {langByCode(settings.myLang).native}</span>
        </button>
        <button
          className={`talk-btn other ${side === 'other' ? 'active' : ''}`}
          onClick={() => startSide('other')}
          disabled={!SpeechListener.supported}
        >
          <span className="talk-icon">{langByCode(settings.otherLang).flag}</span>
          <span>对方说 · {langByCode(settings.otherLang).native}</span>
        </button>
        <button className="mini-btn" aria-label="打字" onClick={() => setShowType((v) => !v)}>
          ⌨️
        </button>
      </footer>

      {pickLang && (
        <LanguagePicker
          title={pickLang === 'myLang' ? '我的语言' : '对方的语言'}
          current={pickLang === 'myLang' ? settings.myLang : settings.otherLang}
          onPick={(code) => patch(pickLang === 'myLang' ? { myLang: code } : { otherLang: code })}
          onClose={() => setPickLang(null)}
        />
      )}

      {bigText && (
        <div className="bigtext-mask" onClick={() => setBigText(null)}>
          <div className="bigtext" onClick={(e) => e.stopPropagation()}>
            <div className="bigtext-original">{bigText.original}</div>
            <div className="bigtext-main">{bigText.translated}</div>
            <div className="bigtext-actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(bigText.translated)
                  props.showToast('已复制')
                }}
              >
                复制
              </button>
              <button className="ghost-btn" onClick={() => t.replay(bigText)}>
                朗读
              </button>
              <button className="ghost-btn" onClick={() => setBigText(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
