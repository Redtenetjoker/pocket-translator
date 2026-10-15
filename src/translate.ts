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

export async function translate(
  text: string,
  from: string,
  to: string,
  kind: ProviderKind,
  llm: LlmConfig,
): Promise<string> {
  const key = `${kind}|${from}|${to}|${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const out =
    kind === 'llm' && llm.apiKey && llm.baseUrl
      ? await translateByLlm(text, from, to, llm)
      : await translateByMyMemory(text, from, to)

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

async function translateByLlm(text: string, from: string, to: string, llm: LlmConfig): Promise<string> {
  const srcName = langByCode(from).name
  const dstName = langByCode(to).name
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
