import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../store'
import { langLabel, timeLabel } from '../App'
import { SpeechListener } from '../stt'
import { keepAwake } from '../tts'
import { summarizeMeeting, translate } from '../translate'
import { langByCode } from '../languages'
import LanguagePicker from './LanguagePicker'

interface Line {
  id: number
  time: number
  text: string
  translated?: string
  failed?: boolean
}

let lineSeq = 1

export default function MeetingPage(props: {
  settings: Settings
  patch: (p: Partial<Settings>) => void
  onBack: () => void
  showToast: (m: string) => void
}) {
  const { settings: s } = props
  const [srcLang, setSrcLang] = useState(s.myLang)
  const [running, setRunning] = useState(false)
  const [autoTranslate, setAutoTranslate] = useState(true)
  const [lines, setLines] = useState<Line[]>([])
  const [partial, setPartial] = useState('')
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [pickLang, setPickLang] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const listener = useRef<SpeechListener | null>(null)
  const stateRef = useRef({ srcLang, autoTranslate, s })
  stateRef.current = { srcLang, autoTranslate, s }

  useEffect(() => {
    const l = new SpeechListener({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => {
        setPartial('')
        addLine(t)
      },
      onError: (m) => props.showToast(m),
    })
    listener.current = l
    return () => {
      l.stop()
      void keepAwake(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, partial])

  const addLine = async (text: string) => {
    const { srcLang: src, autoTranslate: at, s: cfg } = stateRef.current
    const id = lineSeq++
    setLines((ls) => [...ls, { id, time: Date.now(), text }])
    if (!at || src === cfg.myLang) return
    try {
      const out = await translate(text, src, cfg.myLang, cfg.provider, cfg.llm, cfg.glossary)
      setLines((ls) => ls.map((l) => (l.id === id ? { ...l, translated: out } : l)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setLines((ls) => ls.map((l) => (l.id === id ? { ...l, translated: '（翻译失败）', failed: true } : l)))
      props.showToast('翻译失败：' + msg)
    }
  }

  const toggle = () => {
    if (running) {
      listener.current?.stop()
      void keepAwake(false)
      setRunning(false)
    } else {
      if (s.keepScreenOn) void keepAwake(true)
      listener.current?.setLang(srcLang)
      listener.current?.start(srcLang)
      setRunning(true)
    }
  }

  const doSummarize = async () => {
    if (lines.length === 0) {
      props.showToast('还没有内容')
      return
    }
    setSummarizing(true)
    setShowSummary(true)
    try {
      // 用原文行做纪要（若整场是外语，先逐行已翻译过，这里直接用原文本，LLM 能理解多语种）
      const payload = lines.map((l) => ({ time: new Date(l.time).toLocaleTimeString('zh-CN', { hour12: false }), text: l.text }))
      const out = await summarizeMeeting(payload, s.llm)
      setSummary(out)
    } catch (e) {
      setSummary('生成失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSummarizing(false)
    }
  }

  const fullText = () => {
    const head = `会议记录 ${new Date().toLocaleString('zh-CN')}\n会议语言：${langByCode(srcLang).name}\n\n`
    const body = lines
      .map((l) => {
        const t = new Date(l.time).toLocaleTimeString('zh-CN', { hour12: false })
        return `[${t}] ${l.text}${l.translated && !l.failed ? `\n        → ${l.translated}` : ''}`
      })
      .join('\n')
    return head + body + (summary ? `\n\n===== AI 会议纪要 =====\n${summary}` : '')
  }

  const copyAll = () => {
    navigator.clipboard
      ?.writeText(fullText())
      .then(() => props.showToast('已复制全文'))
      .catch(() => props.showToast('复制失败'))
  }

  const download = () => {
    const blob = new Blob([fullText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `会议记录-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const markBreak = () => {
    const id = lineSeq++
    setLines((ls) => [...ls, { id, time: Date.now(), text: '──────────' }])
  }

  return (
    <div className="page meeting">
      <header className="bar">
        <button className="icon-btn" onClick={props.onBack} aria-label="返回">
          ‹
        </button>
        <div className="lang-pair">
          <span className="bar-title">会议记录</span>
        </div>
        <button className="icon-btn" aria-label="会议语言" onClick={() => setPickLang(true)}>
          🌐
        </button>
      </header>

      <div className="meeting-langs" onClick={() => setPickLang(true)}>
        会议语言 <b>{langLabel(srcLang)}</b>
        {srcLang !== s.myLang && (
          <>
            {' '}
            → 逐句译成 <b>{langLabel(s.myLang)}</b>
          </>
        )}
        （点按修改）
      </div>

      <div className="status-row">
        {running ? (
          <span className={`status live ${partial ? 'hearing' : ''}`}>
            🔴 录制中{partial ? `“${partial}”` : '…'}
          </span>
        ) : (
          <span className="status idle">{lines.length > 0 ? '已暂停' : '点击开始，逐句自动转写'}</span>
        )}
      </div>

      <div className="transcript" ref={scroller}>
        {lines.length === 0 && (
          <div className="empty big">
            适合会议、课堂、访谈：
            <br />
            连续转写为文字，外语会议可逐句翻译，
            <br />
            结束后一键生成 AI 会议纪要。
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`mt-line ${l.text.startsWith('───') ? 'break' : ''}`}>
            <span className="mt-time">{timeLabel(l.time).split(' ')[1]}</span>
            <div className="mt-body">
              <div className="mt-text">{l.text}</div>
              {l.translated && <div className={`mt-trans ${l.failed ? 'err' : ''}`}>{l.translated}</div>}
            </div>
          </div>
        ))}
        {partial && (
          <div className="mt-line">
            <span className="mt-time">…</span>
            <div className="mt-body">
              <div className="mt-text dim">{partial}</div>
            </div>
          </div>
        )}
      </div>

      <footer className="meeting-controls">
        <div className="meeting-tools">
          <button className={'tool-chip' + (autoTranslate ? ' on' : '')} onClick={() => setAutoTranslate((v) => !v)}>
            {srcLang === s.myLang ? '转写' : autoTranslate ? '双语 ✓' : '仅原文'}
          </button>
          <button className="tool-chip" onClick={markBreak}>
            ✂︎ 分段
          </button>
          <button className="tool-chip" onClick={copyAll}>
            📋 复制全文
          </button>
          <button className="tool-chip" onClick={download}>
            ⬇︎ 保存
          </button>
          <button className="tool-chip accent" onClick={doSummarize} disabled={summarizing}>
            {summarizing ? '纪要生成中…' : '✨ AI 纪要'}
          </button>
        </div>
        <button className={`listen-btn ${running ? 'active' : ''}`} onClick={toggle} disabled={!SpeechListener.supported}>
          {running ? '⏸ 暂停录制' : '🎤 开始转写'}
        </button>
      </footer>

      {pickLang && (
        <LanguagePicker
          title="会议语言"
          current={srcLang}
          onPick={(code) => {
            setSrcLang(code)
            if (running) {
              listener.current?.stop()
              listener.current?.start(code)
            }
          }}
          onClose={() => setPickLang(false)}
        />
      )}

      {showSummary && (
        <div className="bigtext-mask" onClick={() => setShowSummary(false)}>
          <div className="bigtext summary" onClick={(e) => e.stopPropagation()}>
            <div className="bigtext-original">✨ AI 会议纪要</div>
            <div className="summary-body">{summarizing ? '正在生成，请稍候…' : summary}</div>
            <div className="bigtext-actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(summary)
                  props.showToast('已复制纪要')
                }}
              >
                复制纪要
              </button>
              <button className="ghost-btn" onClick={() => setShowSummary(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
