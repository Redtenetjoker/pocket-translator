/* 翻译服务：双通道
 * 1) free  —— MyMemory 免费接口（无需 key，匿名额度）
 * 2) llm   —— 任意 OpenAI 兼容接口（OpenAI / 智谱GLM / DeepSeek / 通义 / 自定义）
 *             口语化、更自然，适合对话翻译；key 仅保存在本机 localStorage
 */
import { langByCode } from './languages'

export type ProviderKind = 'free' | 'llm'

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export const LLM_PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: '自定义', baseUrl: '', model: '' },
]

const cache = new Map<string, string>()

/** 解析术语表（每行 “原文=译文”） */
export function parseGlossary(glossary: string): { src: string; dst: string }[] {
  return glossary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      if (i <= 0) return null
      const src = line.slice(0, i).trim()
      const dst = line.slice(i + 1).trim()
      return src && dst ? { src, dst } : null
    })
    .filter((x): x is { src: string; dst: string } => x !== null)
}

export async function translate(
  text: string,
  from: string,
  to: string,
  kind: ProviderKind,
  llm: LlmConfig,
  glossary?: string,
): Promise<string> {
  const key = `${kind}|${from}|${to}|${text}|${glossary ?? ''}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const terms = parseGlossary(glossary ?? '')
  let out: string

  if (kind === 'llm' && llm.apiKey && llm.baseUrl) {
    out = await translateByLlm(text, from, to, llm, terms)
  } else {
    out = await translateByMyMemory(text, from, to)
    // 免费通道术语兜底：把译文中的术语词直接替换
    for (const t of terms) {
      if (t.src && t.dst) out = out.split(t.src).join(t.dst)
    }
  }

  if (out) {
    if (cache.size > 500) cache.clear()
    cache.set(key, out)
  }
  return out
}

async function translateByMyMemory(text: string, from: string, to: string): Promise<string> {
  const src = langByCode(from).mm
  const dst = langByCode(to).mm
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    `&langpair=${encodeURIComponent(src)}|${encodeURIComponent(dst)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`)
  const data = await res.json()
  const t = data?.responseData?.translatedText
  if (typeof t === 'string' && t.trim()) return t.trim()
  const match = data?.matches?.find((m: any) => m?.translation)?.translation
  if (match) return String(match).trim()
  throw new Error('MyMemory 未返回译文')
}

async function translateByLlm(
  text: string,
  from: string,
  to: string,
  llm: LlmConfig,
  terms: { src: string; dst: string }[] = [],
): Promise<string> {
  const srcName = langByCode(from).name
  const dstName = langByCode(to).name
  const glossaryRule =
    terms.length > 0
      ? '翻译时必须遵守以下术语表（原文=固定译法）：\n' +
        terms.map((t) => `${t.src}=${t.dst}`).join('\n') +
        '\n'
      : ''
  const res = await fetch(llm.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content:
            `你是专业的口语同声传译员。把用户输入的${srcName}翻译成${dstName}。` +
            glossaryRule +
            '要求：只输出译文本身，不要解释、不要原文、不要引号；保持口语自然、简洁，适合当面交流。',
        },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM HTTP ${res.status} ${detail.slice(0, 160)}`)
  }
  const data = await res.json()
  const t = data?.choices?.[0]?.message?.content
  if (typeof t === 'string' && t.trim()) {
    return t.trim().replace(/^["“”']+|["“”']+$/g, '')
  }
  throw new Error('LLM 未返回译文')
}

/** 会议纪要生成（需要大模型通道） */
export async function summarizeMeeting(
  lines: { time: string; text: string }[],
  llm: LlmConfig,
): Promise<string> {
  if (!llm.apiKey || !llm.baseUrl) throw new Error('请先在设置中配置大模型通道（智谱 glm-4-flash 免费）')
  const transcript = lines.map((l) => `[${l.time}] ${l.text}`).join('\n')
  const res = await fetch(llm.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.3,
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content:
            '你是专业的会议秘书。根据用户提供的会议转写文本，用中文输出结构化会议纪要，' +
            '包含：## 主题、## 要点（分条）、## 结论、## 待办事项（有的话）。语言精炼，不要编造未提及的内容。',
        },
        { role: 'user', content: transcript },
      ],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM HTTP ${res.status} ${detail.slice(0, 160)}`)
  }
  const data = await res.json()
  const t = data?.choices?.[0]?.message?.content
  if (typeof t === 'string' && t.trim()) return t.trim()
  throw new Error('LLM 未返回纪要')
}
