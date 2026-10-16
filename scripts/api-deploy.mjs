#!/usr/bin/env node
/* 通过 GitHub Git Data API 直接发布目录到指定分支（绕过 git 传输）。
 * 用法: node scripts/api-deploy.mjs <目录> <分支> [提交信息]
 * 依赖: gh 已登录（gh auth token 提供凭据）
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const [, , dirArg, branch, message] = process.argv
if (!dirArg || !branch || !message) {
  console.error('用法: node api-deploy.mjs <目录|--tracked> <分支> <提交信息>')
  process.exit(1)
}
const REPO = 'Redtenetjoker/pocket-translator'
const token = execSync('gh auth token').toString().trim()
const tracked = dirArg === '--tracked'
const root = tracked ? process.cwd() : join(process.cwd(), dirArg)

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'pocket-translator-deploy',
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  return body
}

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

const trackedFiles = tracked
  ? execSync('git ls-files', { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
  : null
const files = trackedFiles ?? [...walk(root)]
console.log(`打包 ${files.length} 个文件…`)

// 1. 创建 blob（内容相同时 GitHub 会去重；也用于跳过未变化文件）
const entries = []
for (const f of files) {
  const content = readFileSync(f)
  const path = relative(root, f).split(sep).join('/')
  const { sha } = await api(`/repos/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
  })
  entries.push({ path, mode: '100644', type: 'blob', sha })
  process.stdout.write('.')
}
console.log('')

// 2. 当前分支头（新仓库/新分支则无父提交）
let parentSha = null
try {
  const ref = await api(`/repos/${REPO}/git/ref/heads/${branch}`)
  parentSha = ref.object.sha
} catch {
  console.log(`分支 ${branch} 不存在，将创建`)
}

// 3. 全新根树（不带 base_tree → 旧文件会被清除）
const tree = await api(`/repos/${REPO}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ tree: entries }),
})

// 4. 提交
const commit = await api(`/repos/${REPO}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({
    message,
    tree: tree.sha,
    parents: parentSha ? [parentSha] : [],
  }),
})

// 5. 更新引用
await api(`/repos/${REPO}/git/refs/heads/${branch}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})

console.log(`✅ 已发布 ${branch}: ${commit.sha} (${files.length} 文件)`)
