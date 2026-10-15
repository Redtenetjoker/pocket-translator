import { useState } from 'react'
import { LANGUAGES } from '../languages'

export default function LanguagePicker(props: {
  title: string
  current: string
  onPick: (code: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const list = LANGUAGES.filter(
    (l) => !q || l.name.includes(q) || l.native.toLowerCase().includes(q.toLowerCase()) || l.code.includes(q),
  )
  return (
    <div className="sheet-mask" onClick={props.onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-title">{props.title}</span>
          <button className="ghost-btn" onClick={props.onClose}>
            关闭
          </button>
        </div>
        <input
          className="search"
          placeholder="搜索语言…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="sheet-list">
          {list.map((l) => (
            <button
              key={l.code}
              className={'sheet-item' + (l.code === props.current ? ' active' : '')}
              onClick={() => {
                props.onPick(l.code)
                props.onClose()
              }}
            >
              <span className="sheet-item-flag">{l.flag}</span>
              <span className="sheet-item-name">{l.native}</span>
              <span className="sheet-item-sub">{l.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
