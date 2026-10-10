import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateBackup, planImport, makeNote, review, reviewable, safeRoot, quizFromMarkdown, retrieve } from '../src/core'

function fixture() {
  return {
    version: 2, exportedAt: '2026-10-09T00:00:00.000Z',
    domains: Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, name: `L${i + 1} 知识领域`, order: i })),
    topics: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, domainId: `d${i}`, name: '重复/主题', order: 0 })),
    cards: Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`, topicId: `t${i % 5}`, title: i < 2 ? '../[相同]?#标题' : `概念 ${i}`, order: i,
      definition: `定义 ${i}`, feynman: `自己的解释 ${i}\n\n\`\`\`md\n## 实际应用\n代码中的标题不是分节\n\`\`\``,
      analogy: '类比', details: '细节', pmView: '应用', sources: ['https://example.org/source'],
      followUps: ['为什么？'], tags: ['知识'], quiz: [{ question: '为什么？', answer: '因为资料。', answerHidden: true }],
      linkedIds: [`c${(i + 1) % 25}`], status: 'learning', ease: 2.4, interval: 6, repetitions: 2,
      dueDate: '2026-10-09', createdAt: 1, updatedAt: 2,
    })),
    questions: [{ id: 'q', cardId: 'c0', content: '还有什么条件？', answer: '要验证边界。', resolved: false }],
    reviewLogs: [{ id: 'r', cardId: 'c0', grade: 3, reviewedAt: 1791504000000 }],
    preferences: { decorations: ['tulip'] },
  }
}
function readPlanned(path: string, content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n/)!
  const meta = Object.fromEntries(match[1].split('\n').map(line => {
    const index = line.indexOf(': ')
    return [line.slice(0, index), JSON.parse(line.slice(index + 2))]
  }))
  return makeNote(path, meta, content.slice(match[0].length))
}
test('migration covers every domain, preserves learning content/schedule and resolves every wiki link', () => {
  const backup = validateBackup(JSON.stringify(fixture()))
  const plan = planImport(backup, 'Study Club/导入-测试')
  assert.equal(plan.filter(f => f.content.includes('"card"')).length, 25)
  assert.equal(new Set(plan.map(f => f.path)).size, plan.length)
  const paths = new Set(plan.map(f => f.path.replace(/\.md$/, '')))
  const notes = plan.filter(f => f.content.includes('sc-kind: "card"')).map(f => readPlanned(f.path, f.content))
  for (const card of backup.cards) {
    const n = notes.find(n => n.id === card.id)!
    assert.equal(n.sections['费曼解释'], card.feynman)
    assert.equal(n.sections['实际应用'], card.pmView)
    assert.equal(n.sections['类比故事'], card.analogy)
    assert.equal(n.sections['原理细节'], card.details)
    assert.equal(n.quiz[0].answer, card.quiz[0].answer)
    assert.equal(n.dueDate, card.dueDate)
    assert.equal(n.ease, card.ease)
    assert.ok(n.path.startsWith('Study Club/导入-测试/'))
  }
  for (const file of plan) for (const link of file.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g))
    assert.ok(paths.has(link[1]), `Unresolved link ${link[1]}`)
  assert.equal(new Set(notes.map(n => n.domain)).size, 5)
  assert.ok(plan.some(f => f.content.includes('要验证边界。')))
  assert.ok(plan.some(f => f.content.includes('评分 3')))
})
test('duplicate title/path normalization collisions stay separate', () => {
  const source = fixture()
  source.cards[0].topicId = 't0'; source.cards[1].topicId = 't0'
  source.cards[1].order = source.cards[0].order
  const plan = planImport(validateBackup(JSON.stringify(source)), 'Study Club')
  assert.equal(new Set(plan.map(f => f.path.toLowerCase())).size, plan.length)
})
test('invalid data stops before producing files and parent traversal is rejected', () => {
  assert.throws(() => validateBackup('{}'), /缺少/)
  const invalid = fixture(); invalid.cards[0].topicId = 'missing'
  assert.throws(() => validateBackup(JSON.stringify(invalid)), /不存在的主题/)
  const duplicate = fixture(); duplicate.cards[1].id = duplicate.cards[0].id
  assert.throws(() => validateBackup(JSON.stringify(duplicate)), /重复 ID/)
  for (const path of ['../outside', '/absolute', '.obsidian/plugins', 'foo/../bar', 'a//b'])
    assert.throws(() => safeRoot(path))
})
test('SM-2 writes a new schedule without mutating the original, with local calendar rollover', () => {
  const before = { ease: 2.5, interval: 6, repetitions: 2, dueDate: '2026-12-30' }
  const good = review(before, 3, new Date(2026, 11, 30, 23))
  assert.equal(good.interval, 15); assert.equal(good.dueDate, '2027-01-14')
  const again = review(before, 1, new Date(2026, 11, 30))
  assert.equal(again.repetitions, 0); assert.equal(again.dueDate, '2026-12-30')
  assert.equal(before.ease, 2.5); assert.equal(before.interval, 6)
  assert.equal(review({ ...before, ease: 1.3 }, 1).ease, 1.3)
  assert.throws(() => review(before, 9))
})
test('empty templates and empty quiz prompts do not become learning sessions', () => {
  const note = makeNote('empty.md', { 'sc-kind': 'card', 'sc-status': 'learning' },
    '# 空白\n\n## 一句话定义\n\n## 费曼解释\n\n## 自测\n\n### 问题 1\n\n#### 答案\n\n')
  assert.equal(reviewable(note), false)
  assert.equal(note.quiz.length, 0)
  const adopted = makeNote('existing.md', { 'sc-status': 'learning' }, '这是我原来写下的一段解释。')
  assert.equal(reviewable(adopted), true)
})
test('quiz parser ignores headings inside fenced code', () => {
  const quiz = quizFromMarkdown('### 问题 1\n请解释代码：\n```md\n#### 答案\n```\n#### 答案\n这是代码示例。\n### 问题 2\n第二题\n#### 答案\n第二个答案')
  assert.equal(quiz.length, 2)
  assert.ok(quiz[0].question.includes('#### 答案'))
  assert.equal(quiz[1].answer, '第二个答案')
})
test('local retrieval includes linked evidence and excludes blank cards', () => {
  const a = makeNote('rag.md', { 'sc-title': 'RAG' }, '## 费曼解释\n先检索资料，再组织答案。')
  const b = makeNote('citation.md', { 'sc-title': '引用' }, '## 费曼解释\n每个结论都要核对来源。')
  const blank = makeNote('blank.md', { 'sc-title': 'RAG' }, '## 费曼解释\n\n')
  const result = retrieve([a, b, blank], 'RAG 如何检索？', n => n.path === a.path ? ['citation.md'] : [])
  assert.equal(result[0].note.path, a.path)
  assert.ok(result.some(r => r.note.path === b.path && r.reason === 'KG 关联'))
  assert.ok(!result.some(r => r.note.path === blank.path))
  assert.deepEqual(retrieve([a], '', () => []), [])
})
