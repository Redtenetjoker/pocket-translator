import { useEffect, useRef, useState } from 'react'
import { useTranslator, type Turn } from '../App'
import { stopSpeaking, speak } from '../tts'
import { langByCode } from '../languages'
import type { Settings } from '../store'
import LanguagePicker from './LanguagePicker'

/**
 * 电话模式 —— 双设备免提旁听专用：
 * iPhone 开免提接客户电话 → 电脑/平板打开本页放旁边 →
 * 逐句自动识别（双向自动交替）→ 大字幕 → 自动朗读译文。
 * TTS 播放期间暂停识别，防止"电脑自己翻译自己"的回声循环。
 */
export default function CallModePage(props: {
  settings: Settings
  patch: (p: Partial<Settings>) => void
  onBack: () => void
  showToast: (m: string) => void
  onTurn: (original: string, translated: string, from: string, to: string) => void
}) {
  const { settings } = props
  const [running, setRunning] = useState(false)
  const [side, setSide] = useState<'me' | 'other'>('other') // 当前在听谁
  const [autoFlip, setAutoFlip] = useState(true)
  const [pickLang, setPickLang] = useState<'myLang' | 'otherLang' | null>(null)
  const [last, setLast] = useState<Turn | null>(null)
  const t = useTranslator({ settings, showToast: props.showToast, onTurn: props.onTurn })

  // 自动交替引擎：一句话翻完并朗读结束后 → 换向继续听
  const busyRef = useRef(false)
  const runningRef = useRef(false)
  const sideRef = useRef<'me' | 'other'>('other')
  runningRef.current = running
  sideRef.current = side

  useEffect(() => {
    return () => {
      t.stopListening()
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听 turns：新一轮译文出现 → 朗读（用自定义流程防回声）
  useEffect(() => {
    const n = t.turns.length
    if (n === 0 || busyRef.current) return
    const turn = t.turns[n - 1]
    if (turn.error) {
      // 出错不朗读，直接换向继续
      flipAndResume()
      return
    }
    setLast(turn)
    const s = settingsRef.current
    const to = turn.side === 'me' ? s.otherLang : s.myLang
    busyRef.current = true
    t.stopListening() // 播报期间停止拾音（防回声循环）
    speak(turn.translated, to, {
      rate: s.speakRate,
      onEnd: () => {
        busyRef.current = false
        flipAndResume()
      },
    })
    // 兜底：TTS 事件丢失时 12 秒后自动恢复
    window.setTimeout(() => {
      if (busyRef.current) {
        busyRef.current = false
        flipAndResume()
      }
    }, 12000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.turns])

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const flipAndResume = () => {
    if (!runningRef.current) return
    const next = autoFlipRef.current ? (sideRef.current === 'me' ? 'other' : 'me') : sideRef.current
    setSide(next)
    t.setSide(next)
    t.startListening(next)
  }
  const autoFlipRef = useRef(autoFlip)
  autoFlipRef.current = autoFlip

  const start = (s: 'me' | 'other') => {
    setRunning(true)
    setSide(s)
    t.setSide(s)
    t.startListening(s)
  }

  const stop = () => {
    setRunning(false)
    busyRef.current = false
    t.stopListening()
    stopSpeaking()
  }

  const manualSide = (s: 'me' | 'other') => {
    // 手动指定方向：立即切换监听对象
    setSide(s)
    t.setSide(s)
    if (running) {
      busyRef.current = false
      stopSpeaking()
      t.stopListening()
      window.setTimeout(() => t.startListening(s), 200)
    }
  }

  return (
    <div className="page callmode">
      <header className="bar">
        <button className="icon-btn" onClick={props.onBack} aria-label="返回">
          ‹
        </button>
        <div className="lang-pair">
          <button className={`lang-chip ${side === 'other' ? 'call-on-other' : ''}`} onClick={() => manualSide('other')}>
            客户 {langByCode(settings.otherLang).flag}
          </button>
          <span className="call-arrow">⇄</span>
          <button className={`lang-chip ${side === 'me' ? 'call-on-me' : ''}`} onClick={() => manualSide('me')}>
            我 {langByCode(settings.myLang).flag}
          </button>
        </div>
        <button
          className={'icon-btn' + (pickLang ? ' on' : '')}
          aria-label="语言"
          onClick={() => setPickLang('otherLang')}
        >
          🌐
        </button>
      </header>

      <div className="status-row">
        {running ? (
          <span className={`status live ${t.partial ? 'hearing' : ''}`}>
            🎧 正在听「{side === 'me' ? '我' : '客户'}」{t.partial ? `“${t.partial.slice(0, 16)}”` : '…'}
          </span>
        ) : (
          <span className="status idle">手机开免提放电脑旁，点开始</span>
        )}
        {t.busyTranslating && <span className="status busy">翻译中…</span>}
        <button
          className={`status ${autoFlip ? 'live' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setAutoFlip((v) => !v)}
        >
          自动换向 {autoFlip ? '✓' : '✗（点我开）'}
        </button>
      </div>

      <div className="call-caption">
        {last ? (
          <>
            <div className="call-caption-original">{last.original}</div>
            <div className={`call-caption-main ${last.side === 'me' ? 'mine' : 'theirs'}`}>{last.translated}</div>
          </>
        ) : (
          <div className="call-caption-empty">
            接听客户电话 → 手机开<span className="hl">免提</span> → 放到这台电脑旁边 → 点下方开始
            <br />
            客户说外语自动译成中文朗读；你说中文自动译成外语朗读（手机麦克风会收进去传给客户）
          </div>
        )}
      </div>

      <div className="call-history">
        {t.turns
          .slice(-6)
          .reverse()
          .map((turn) => (
            <div key={turn.id} className={`call-row ${turn.side}`}>
              <span className="call-row-side">{turn.side === 'me' ? '我' : '客户'}</span>
              <span className="call-row-original">{turn.original}</span>
              <span className="call-row-translated">{turn.translated}</span>
            </div>
          ))}
      </div>

      <footer className="call-controls">
        <button className={`listen-btn ${running ? 'active' : ''}`} onClick={running ? stop : () => start(side)}>
          {running ? '■ 停止' : '📞 开始电话翻译'}
        </button>
      </footer>

      {pickLang && (
        <LanguagePicker
          title="客户语言（要听的外语）"
          current={settings.otherLang}
          onPick={(code) => props.patch({ otherLang: code })}
          onClose={() => setPickLang(null)}
        />
      )}
    </div>
  )
}
