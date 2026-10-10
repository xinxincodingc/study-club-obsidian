export type Status = 'to-learn' | 'learning' | 'understood' | 'mastered'
export const STATUS: Record<Status, string> = { 'to-learn': '待学习', learning: '学习中', understood: '已理解', mastered: '已掌握' }
export interface Quiz { question: string; answer: string }
export interface Schedule { ease: number; interval: number; repetitions: number; dueDate: string }
export interface Card extends Schedule {
  id: string; topicId: string; title: string; order: number; status: Status;
  definition: string; feynman: string; analogy: string; details: string; pmView: string;
  tags: string[]; followUps: string[]; sources: string[]; quiz: Quiz[]; linkedIds: string[];
  createdAt: number; updatedAt: number
}
export interface Backup {
  version: number; exportedAt: string;
  domains: { id: string; name: string; order: number }[];
  topics: { id: string; domainId: string; name: string; order: number }[];
  cards: Card[];
  questions: { id: string; cardId: string | null; content: string; answer: string; resolved: boolean }[];
  reviewLogs: { id: string; cardId: string; grade: number; reviewedAt: number }[];
  preferences?: unknown
}
export interface Note extends Schedule {
  path: string; title: string; id: string; domain: string; topic: string; status: Status;
  body: string; sections: Record<string, string>; quiz: Quiz[]
}
export interface PlannedFile { path: string; content: string }
const str = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const num = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback
const list = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
export function day(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function schedule(value: Record<string, unknown>): Schedule {
  const due = str(value.dueDate, day())
  return {
    ease: Math.max(1.3, num(value.ease, 2.5)), interval: Math.max(0, Math.round(num(value.interval, 0))),
    repetitions: Math.max(0, Math.round(num(value.repetitions, 0))),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : day(),
  }
}
export function review(current: Schedule, grade: number, date = new Date()): Schedule {
  if (![1, 2, 3, 4].includes(grade)) throw new Error('评分必须是 1—4。')
  const next = { ...schedule(current as unknown as Record<string, unknown>) }
  if (grade === 1) { next.ease = Math.max(1.3, next.ease - .2); next.interval = 0; next.repetitions = 0 }
  else {
    next.repetitions++
    if (grade === 2) { next.interval = Math.max(1, Math.round((next.interval || 1) * 1.2)); next.ease = Math.max(1.3, next.ease - .15) }
    else {
      next.interval = next.repetitions === 1 ? 1 : next.repetitions === 2 ? 6 :
        Math.max(1, Math.round(next.interval * next.ease * (grade === 4 ? 1.3 : 1)))
      if (grade === 4) next.ease += .15
    }
  }
  const due = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  due.setDate(due.getDate() + next.interval)
  return { ...next, ease: Math.round(next.ease * 100) / 100, dueDate: day(due) }
}
export function reviewable(note: Note): boolean {
  return note.repetitions > 0 || (note.status !== 'to-learn' &&
    Boolean((note.sections['一句话定义'] || note.sections['费曼解释'] || '').trim()))
}
export function safeSegment(value: string): string {
  const cleaned = value.normalize('NFC').replace(/[\\/:*?"<>|#\[\]\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 72).trim()
  return cleaned || '未命名'
}
export function safeRoot(root: string): string {
  const parts = root.replace(/\\/g, '/').split('/')
  if (!parts.length || parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.') || safeSegment(p) !== p))
    throw new Error('目录请使用仓库内的普通文件夹名称，例如 Study Club；不能使用隐藏目录或 ../。')
  return parts.join('/')
}
export function wikilink(path: string, label?: string): string {
  const target = path.replace(/\.md$/, '')
  return `[[${target}${label ? `|${label.replace(/[\[\]|#\r\n]/g, ' ')}` : ''}]]`
}
export function frontmatter(values: Record<string, unknown>): string {
  return `---\n${Object.entries(values).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n`
}
export function validateBackup(text: string): Backup {
  let raw: Record<string, unknown>
  try { raw = JSON.parse(text) } catch { throw new Error('不是有效的 JSON 文件。') }
  if (!raw || typeof raw !== 'object') throw new Error('备份结构不正确。')
  for (const key of ['domains', 'topics', 'cards', 'questions', 'reviewLogs']) {
    if (!Array.isArray(raw[key])) throw new Error(`缺少 ${key}，请选择 Study Club 全量 JSON 备份。`)
    const ids = new Set()
    for (const item of raw[key] as Record<string, unknown>[]) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(`${key} 包含无效或重复 ID。`)
      ids.add(item.id)
    }
  }
  const domains = (raw.domains as Record<string, unknown>[]).map(d => ({
    id: str(d.id), name: str(d.name, '未命名领域'), order: num(d.order, 0),
  }))
  const topics = (raw.topics as Record<string, unknown>[]).map(t => ({
    id: str(t.id), domainId: str(t.domainId), name: str(t.name, '未命名主题'), order: num(t.order, 0),
  }))
  if (topics.some(t => !domains.some(d => d.id === t.domainId))) throw new Error('主题引用了不存在的领域，已停止导入。')
  const cards: Card[] = (raw.cards as Record<string, unknown>[]).map(c => ({
    id: str(c.id), topicId: str(c.topicId), title: str(c.title, '未命名卡片'), order: num(c.order, 0),
    status: Object.hasOwn(STATUS, str(c.status)) ? c.status as Status : 'to-learn',
    definition: str(c.definition), feynman: str(c.feynman), analogy: str(c.analogy),
    details: str(c.details), pmView: str(c.pmView), tags: list(c.tags), followUps: list(c.followUps),
    sources: list(c.sources), linkedIds: list(c.linkedIds),
    quiz: Array.isArray(c.quiz) ? c.quiz.filter(q => q && typeof q.question === 'string' && typeof q.answer === 'string') : [],
    createdAt: num(c.createdAt, Date.now()), updatedAt: num(c.updatedAt, Date.now()), ...schedule(c),
  }))
  if (cards.some(c => !topics.some(t => t.id === c.topicId))) throw new Error('卡片引用了不存在的主题，已停止导入。')
  const ids = new Set(cards.map(c => c.id))
  if (cards.some(c => c.linkedIds.some(id => !ids.has(id)))) throw new Error('备份存在失效的卡片关联，已停止导入，请先检查原文件。')
  const questions = (raw.questions as Record<string, unknown>[]).map(q => ({
    id: str(q.id), cardId: typeof q.cardId === 'string' ? q.cardId : null,
    content: str(q.content), answer: str(q.answer), resolved: q.resolved === true,
  }))
  const reviewLogs = (raw.reviewLogs as Record<string, unknown>[]).map(r => ({
    id: str(r.id), cardId: str(r.cardId), grade: num(r.grade, 1), reviewedAt: num(r.reviewedAt, 0),
  }))
  return { version: num(raw.version, 0), exportedAt: str(raw.exportedAt), domains, topics, cards, questions, reviewLogs, preferences: raw.preferences }
}
export function planImport(backup: Backup, destination: string): PlannedFile[] {
  const root = safeRoot(destination)
  const sort = <T extends { order: number; id: string }>(xs: T[]) => [...xs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const files: PlannedFile[] = []
  const paths = new Map<string, string>()
  const domainPaths = new Map<string, string>()
  const topicPaths = new Map<string, string>()
  sort(backup.domains).forEach((d, i) => domainPaths.set(d.id, `${root}/${String(i + 1).padStart(2, '0')} ${safeSegment(d.name)}`))
  for (const d of backup.domains) sort(backup.topics.filter(t => t.domainId === d.id)).forEach((t, i) =>
    topicPaths.set(t.id, `${domainPaths.get(d.id)}/${String(i + 1).padStart(2, '0')} ${safeSegment(t.name)}`))
  for (const t of backup.topics) sort(backup.cards.filter(c => c.topicId === t.id)).forEach((c, i) =>
    paths.set(c.id, `${topicPaths.get(t.id)}/${String(i + 1).padStart(3, '0')} ${safeSegment(c.title)}.md`))
  for (const c of backup.cards) {
    const t = backup.topics.find(t => t.id === c.topicId)!
    const d = backup.domains.find(d => d.id === t.domainId)!
    const values = { 'sc-kind': 'card', 'sc-id': c.id, 'sc-title': c.title, 'sc-domain': d.name, 'sc-topic': t.name,
      'sc-status': c.status, 'sc-ease': c.ease, 'sc-interval': c.interval, 'sc-repetitions': c.repetitions,
      'sc-due': c.dueDate, 'sc-created': c.createdAt, 'sc-updated': c.updatedAt, 'sc-tags': c.tags }
    const sections = [
      ['一句话定义', c.definition], ['费曼解释', c.feynman], ['类比故事', c.analogy],
      ['原理细节', c.details], ['实际应用', c.pmView],
      ['追问', c.followUps.map(q => `- [ ] ${q}`).join('\n')],
      ['来源', c.sources.map(s => `- ${s}`).join('\n')],
      ['自测', c.quiz.map((q, i) => `### 问题 ${i + 1}\n\n${q.question}\n\n#### 答案\n\n${q.answer}`).join('\n\n')],
      ['关联笔记', c.linkedIds.map(id => wikilink(paths.get(id)!)).join('\n\n')],
    ]
    files.push({ path: paths.get(c.id)!, content: frontmatter(values) + `# ${c.title}\n\n` +
      sections.map(([title, value]) => `## ${title}\n\n${value}\n`).join('\n') })
  }
  backup.questions.forEach((q, i) => files.push({
    path: `${root}/追问/${String(i + 1).padStart(4, '0')} ${safeSegment(q.content)}.md`,
    content: frontmatter({ 'sc-kind': 'question', 'sc-id': q.id, 'sc-resolved': q.resolved }) +
      `# ${q.content}\n\n${q.cardId && paths.has(q.cardId) ? wikilink(paths.get(q.cardId)!) : ''}\n\n## 我的回答\n\n${q.answer}\n`,
  }))
  files.push({ path: `${root}/复习记录.md`, content: '# 导入的复习记录\n\n' +
    backup.reviewLogs.map(r => `- ${new Date(r.reviewedAt).toISOString()} · 评分 ${r.grade} · ${paths.has(r.cardId) ? wikilink(paths.get(r.cardId)!) : r.cardId}`).join('\n') + '\n' })
  files.push({ path: `${root}/学习目录.md`, content: '# 我的学习目录\n\n' +
    sort(backup.domains).map(d => `## ${d.name}\n\n` + sort(backup.topics.filter(t => t.domainId === d.id))
      .map(t => `### ${t.name}\n\n` + sort(backup.cards.filter(c => c.topicId === t.id)).map(c => `- ${wikilink(paths.get(c.id)!, c.title)}`).join('\n')).join('\n\n')).join('\n\n') + '\n' })
  return files
}
export function splitSections(body: string): Record<string, string> {
  const known = new Set(['一句话定义', '费曼解释', '类比故事', '原理细节', '实际应用', '追问', '来源', '自测', '关联笔记', '我的回答'])
  const sections: Record<string, string> = {}
  let current = '', fence = ''
  for (const line of body.split('\n')) {
    const code = line.match(/^\s*(`{3,}|~{3,})/)
    if (code) { if (!fence) fence = code[1]; else if (code[1][0] === fence[0] && code[1].length >= fence.length) fence = '' }
    const header = !fence && line.match(/^## (.+?)\s*$/)
    if (header && known.has(header[1])) { current = header[1]; sections[current] ??= ''; continue }
    if (current) sections[current] += line + '\n'
  }
  for (const k in sections) sections[k] = sections[k].trim()
  if (!Object.keys(sections).length) sections['费曼解释'] = body.trim()
  return sections
}
export function quizFromMarkdown(section: string): Quiz[] {
  const quizzes: Quiz[] = []
  let mode = '', q = '', a = '', fence = ''
  const push = () => { if (q.trim() && a.trim()) quizzes.push({ question: q.trim(), answer: a.trim() }); q = ''; a = '' }
  for (const line of section.split('\n')) {
    const code = line.match(/^\s*(`{3,}|~{3,})/)
    if (code) { if (!fence) fence = code[1]; else if (code[1][0] === fence[0] && code[1].length >= fence.length) fence = '' }
    if (!fence && /^### 问题(?:\s+\d+)?\s*$/.test(line)) { push(); mode = 'q' }
    else if (!fence && /^#### 答案\s*$/.test(line)) mode = 'a'
    else if (mode === 'q') q += line + '\n'
    else if (mode === 'a') a += line + '\n'
  }
  push()
  return quizzes
}
export function makeNote(path: string, meta: Record<string, unknown>, body: string): Note {
  const sections = splitSections(body)
  return { path, title: str(meta['sc-title'], path.split('/').pop()?.replace(/\.md$/, '') || '未命名'),
    id: str(meta['sc-id'], path), domain: str(meta['sc-domain'], '我的知识库'), topic: str(meta['sc-topic'], '未分类'),
    status: Object.hasOwn(STATUS, str(meta['sc-status'])) ? meta['sc-status'] as Status : 'to-learn',
    ...schedule({ ease: meta['sc-ease'], interval: meta['sc-interval'], repetitions: meta['sc-repetitions'], dueDate: meta['sc-due'] }),
    body, sections, quiz: quizFromMarkdown(sections['自测'] || '') }
}
export function excerpt(note: Note, max = 1600): string {
  return ['一句话定义', '费曼解释', '类比故事', '原理细节', '实际应用'].map(k => note.sections[k] || '').filter(Boolean).join('\n\n').slice(0, max)
}
export function retrieve(notes: Note[], query: string, neighbors: (note: Note) => string[]): { note: Note; reason: string }[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const tokens = new Set(normalized.match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g) || [])
  for (const t of [...tokens]) if (/^[\u3400-\u9fff]+$/.test(t)) for (let i = 0; i < t.length - 1; i++) tokens.add(t.slice(i, i + 2))
  const ranked = notes.filter(n => excerpt(n).trim()).map(note => {
    const body = (note.title + '\n' + excerpt(note, 8000)).toLowerCase()
    const score = [...tokens].reduce((s, t) => s + (body.includes(t) ? t.length : 0), 0) +
      (normalized.includes(note.title.toLowerCase()) ? 12 : 0)
    return { note, score }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)
  const result = ranked.map(x => ({ note: x.note, reason: '正文匹配' }))
  for (const match of ranked.slice(0, 2)) for (const path of neighbors(match.note)) {
    const note = notes.find(n => n.path === path)
    if (note && excerpt(note).trim() && !result.some(x => x.note.path === path) && result.length < 6)
      result.push({ note, reason: 'KG 关联' })
  }
  return result
}
