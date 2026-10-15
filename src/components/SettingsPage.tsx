import { useState } from 'react'
import type { Settings } from '../store'
import { LLM_PRESETS, translate } from '../translate'
import { ttsVoiceName } from '../tts'
import { langByCode } from '../languages'
import LanguagePicker from './LanguagePicker'

export default function SettingsPage(props: {
  settings: Settings
  patch: (p: Partial<Settings>) => void
  onBack: () => void
  showToast: (m: string) => void
}) {
  const { settings: s, patch } = props
  const [pickLang, setPickLang] = useState<'myLang' | 'otherLang' | null>(null)
  const [testing, setTesting] = useState(false)

  const applyPreset = (label: string) => {
    const p = LLM_PRESETS.find((x) => x.label === label)
    if (!p) return
    if (p.label === '自定义') {
      patch({ llm: { ...s.llm } })
      return
    }
    patch({ llm: { ...s.llm, baseUrl: p.baseUrl, model: p.model } })
  }

  const testLlm = async () => {
    setTesting(true)
    try {
      const out = await translate('你好，很高兴认识你！', 'zh-CN', 'en-US', 'llm', s.llm)
      props.showToast('✅ 测试成功：' + out)
    } catch (e) {
      props.showToast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setTesting(false)
    }
  }

  const presetLabel =
    LLM_PRESETS.find((p) => p.baseUrl === s.llm.baseUrl)?.label ?? '自定义'

  return (
    <div className="page settings">
      <header className="bar">
        <button className="icon-btn" onClick={props.onBack} aria-label="返回">
          ‹
        </button>
        <div className="lang-pair">
          <span className="bar-title">设置</span>
        </div>
        <span className="icon-btn ghost" />
      </header>

      <section className="card">
        <div className="card-title">翻译引擎</div>
        <div className="seg">
          <button
            className={'seg-btn' + (s.provider === 'free' ? ' on' : '')}
            onClick={() => patch({ provider: 'free' })}
          >
            免费通道
          </button>
          <button
            className={'seg-btn' + (s.provider === 'llm' ? ' on' : '')}
            onClick={() => patch({ provider: 'llm' })}
          >
            大模型（更自然）
          </button>
        </div>
        <p className="hint">
          免费通道使用 MyMemory 公共接口，无需注册；大模型通道口语更自然，需要自己的 API Key（仅保存在本机）。
        </p>

        {s.provider === 'llm' && (
          <div className="llm-form">
            <label className="field">
              <span>服务商</span>
              <select value={presetLabel} onChange={(e) => applyPreset(e.target.value)}>
                {LLM_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>接口地址 Base URL</span>
              <input
                value={s.llm.baseUrl}
                onChange={(e) => patch({ llm: { ...s.llm, baseUrl: e.target.value.trim() } })}
                placeholder="https://…/v1"
              />
            </label>
            <label className="field">
              <span>模型</span>
              <input
                value={s.llm.model}
                onChange={(e) => patch({ llm: { ...s.llm, model: e.target.value.trim() } })}
                placeholder="glm-4-flash / deepseek-chat …"
              />
            </label>
            <label className="field">
              <span>API Key</span>
              <input
                type="password"
                value={s.llm.apiKey}
                onChange={(e) => patch({ llm: { ...s.llm, apiKey: e.target.value.trim() } })}
                placeholder="sk-…"
              />
            </label>
            <button className="small-btn wide" onClick={testLlm} disabled={testing}>
              {testing ? '测试中…' : '测试连通性'}
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">语言</div>
        <button className="row-btn" onClick={() => setPickLang('myLang')}>
          <span>我的语言</span>
          <span className="row-value">{langByCode(s.myLang).flag} {langByCode(s.myLang).name}</span>
        </button>
        <button className="row-btn" onClick={() => setPickLang('otherLang')}>
          <span>对方/倾听语言</span>
          <span className="row-value">{langByCode(s.otherLang).flag} {langByCode(s.otherLang).name}</span>
        </button>
      </section>

      <section className="card">
        <div className="card-title">朗读</div>
        <button className="row-btn" onClick={() => patch({ autoSpeak: !s.autoSpeak })}>
          <span>自动朗读译文</span>
          <span className={'switch' + (s.autoSpeak ? ' on' : '')}>
            <i />
          </span>
        </button>
        <label className="field slider">
          <span>朗读速度 {s.speakRate.toFixed(1)}×</span>
          <input
            type="range"
            min="0.6"
            max="1.6"
            step="0.1"
            value={s.speakRate}
            onChange={(e) => patch({ speakRate: Number(e.target.value) })}
          />
        </label>
        <p className="hint">
          本机可用声音：{langByCode(s.otherLang).native} → {ttsVoiceName(s.otherLang) ?? '系统默认（可在设置-辅助功能-朗读内容下载更好音色）'}
        </p>
      </section>

      <section className="card">
        <div className="card-title">其他</div>
        <button className="row-btn" onClick={() => patch({ keepScreenOn: !s.keepScreenOn })}>
          <span>翻译时保持屏幕常亮</span>
          <span className={'switch' + (s.keepScreenOn ? ' on' : '')}>
            <i />
          </span>
        </button>
        <p className="hint">
          提示：iPhone 上首次使用需允许麦克风权限；戴上任意蓝牙耳机，手机会自动切换到耳机麦克风和扬声器。
        </p>
      </section>

      <footer className="about">
        口袋同传 · 自制开源翻译工具
        <br />
        灵感来自对某翻译耳机 App 的逆向分析 —— 耳机只是麦克风，翻译靠手机就够了。
      </footer>

      {pickLang && (
        <LanguagePicker
          title={pickLang === 'myLang' ? '我的语言' : '对方/倾听语言'}
          current={pickLang === 'myLang' ? s.myLang : s.otherLang}
          onPick={(code) => patch(pickLang === 'myLang' ? { myLang: code } : { otherLang: code })}
          onClose={() => setPickLang(null)}
        />
      )}
    </div>
  )
}
