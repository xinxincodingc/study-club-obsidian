import { readFile, mkdir, writeFile, access } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { validateBackup, planImport, day } from '../src/core'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('用法：node migrate.mjs <全量备份.json> <新的仓库目录>')
const destination = resolve(output)
try { await access(destination); throw new Error('目标目录已存在；请选择新目录，避免覆盖已有笔记。') }
catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
const raw = await readFile(input, 'utf8')
const backup = validateBackup(raw)
const root = `01 知识库/导入-${day()}`
const plan = planImport(backup, root)
plan.unshift({ path: `${root}/原始备份.json`, content: raw })
for (const file of plan) {
  const path = join(destination, file.path)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, file.content, { flag: 'wx' })
}
const report = {
  completedAt: new Date().toISOString(), domains: backup.domains.length, topics: backup.topics.length,
  cards: backup.cards.length, questions: backup.questions.length, reviewLogs: backup.reviewLogs.length,
  writtenFiles: plan.length,
}
await writeFile(join(destination, root, '导入校验.json'), JSON.stringify(report, null, 2), { flag: 'wx' })
console.log(JSON.stringify(report))
