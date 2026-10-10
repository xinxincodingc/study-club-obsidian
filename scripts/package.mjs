import { zipSync, strToU8 } from 'fflate'
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

async function tree(directory, prefix) {
  const entries = {}
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    const name = `${prefix}/${item.name}`
    if (item.isDirectory()) Object.assign(entries, await tree(file, name))
    else entries[name] = new Uint8Array(await readFile(file))
  }
  return entries
}
await mkdir('downloads', { recursive: true })
const license = new Uint8Array(await readFile('LICENSE'))
const plugin = { ...await tree('dist/plugin', 'study-club'), 'study-club/LICENSE': license }
const theme = { ...await tree('dist/theme', 'Study Club'), 'Study Club/LICENSE': license }
const starter = 'Study Club Starter'
const vault = {
  ...await tree('example-vault', starter),
  ...await tree('dist/plugin', `${starter}/.obsidian/plugins/study-club`),
  ...await tree('dist/theme', `${starter}/.obsidian/themes/Study Club`),
  [`${starter}/LICENSE`]: license,
  [`${starter}/.obsidian/community-plugins.json`]: strToU8(JSON.stringify(['study-club'])),
  [`${starter}/开始使用.md`]: strToU8('# 开始使用\n\n在设置中启用 Study Club 插件，并选择 Study Club 主题。\n\n点击侧栏书本爱心图标进入手账。\n\n可选安装 Claudian、Dataview、Tasks、Calendar、Kanban；这些第三方插件不包含在此安装包中。模型服务需自行配置。\n\n示例内容仅用于演示。更多说明请查看项目 README。\n'),
}
for (const [name, contents] of [
  ['study-club-plugin', plugin], ['study-club-theme', theme], ['study-club-starter', vault],
]) {
  await writeFile(`downloads/${name}.zip`, zipSync(contents, { level: 9 }))
  console.log(`Packaged downloads/${name}.zip`)
}
