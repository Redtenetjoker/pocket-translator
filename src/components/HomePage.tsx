import type { HistoryItem, Settings } from '../store'
import { langLabel, timeLabel, type Route } from '../App'

export default function HomePage(props: {
  settings: Settings
  history: HistoryItem[]
  onClearHistory: () => void
  onGo: (r: Route) => void
}) {
  const { settings, history } = props
  return (
    <div className="page">
      <header className="home-head">
        <div className="brand">
          <div className="brand-logo">译</div>
          <div>
            <div className="brand-name">口袋同传</div>
            <div className="brand-sub">
              {langLabel(settings.myLang)} ⇄ {langLabel(settings.otherLang)}
            </div>
          </div>
        </div>
        <button className="icon-btn" aria-label="设置" onClick={() => props.onGo('settings')}>
          ⚙︎
        </button>
      </header>

      <main className="home-modes">
        <button className="mode-card primary" onClick={() => props.onGo('call')}>
          <div className="mode-icon">📞</div>
          <div className="mode-body">
            <div className="mode-title">电话翻译（免提旁听）</div>
            <div className="mode-desc">手机开免提放电脑旁，双向自动交替翻译+大字幕+自动朗读。客户零配合。</div>
          </div>
          <div className="mode-arrow">›</div>
        </button>
        <button className="mode-card" onClick={() => props.onGo('facetoface')}>
          <div className="mode-icon">🗣️</div>
          <div className="mode-body">
            <div className="mode-title">面对面翻译</div>
            <div className="mode-desc">我说中文手机说外语；对方说外语我听中文。支持任意蓝牙耳机。</div>
          </div>
          <div className="mode-arrow">›</div>
        </button>
        <button className="mode-card" onClick={() => props.onGo('ambient')}>
          <div className="mode-icon">👂</div>
          <div className="mode-body">
            <div className="mode-title">倾听模式</div>
            <div className="mode-desc">持续听周围外语，实时翻译成你的语言并朗读。</div>
          </div>
          <div className="mode-arrow">›</div>
        </button>
        <button className="mode-card" onClick={() => props.onGo('meeting')}>
          <div className="mode-icon">📝</div>
          <div className="mode-body">
            <div className="mode-title">会议记录</div>
            <div className="mode-desc">连续转写为逐字稿，外语可逐句翻译，一键生成 AI 会议纪要。</div>
          </div>
          <div className="mode-arrow">›</div>
        </button>
      </main>

      <section className="home-history">
        <div className="sec-head">
          <span>翻译记录</span>
          {history.length > 0 && (
            <button className="ghost-btn" onClick={props.onClearHistory}>
              清空
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="empty">还没有记录，去试试面对面翻译吧</div>
        ) : (
          <ul className="history-list">
            {history.slice(0, 20).map((h, i) => (
              <li key={i} className="history-item">
                <div className="history-meta">
                  {timeLabel(h.time)} · {langLabel(h.from)} → {langLabel(h.to)}
                </div>
                <div className="history-original">{h.original}</div>
                <div className="history-translated">{h.translated}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="home-foot">
        使用 iPhone Safari 打开并「添加到主屏幕」即可当 App 使用；麦克风权限需允许。
      </footer>
    </div>
  )
}
