import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
await mkdir('dist/plugin', { recursive: true })
await mkdir('dist/theme', { recursive: true })
await build({
  entryPoints: ['src/main.ts'], outfile: 'dist/plugin/main.js', bundle: true,
  format: 'cjs', target: 'es2020', external: ['obsidian'], platform: 'browser',
  sourcemap: false, minify: false,
})
for (const name of ['manifest.json', 'styles.css']) await copyFile(name, `dist/plugin/${name}`)
for (const name of ['manifest.json', 'theme.css']) await copyFile(`theme/${name}`, `dist/theme/${name}`)
await build({
  entryPoints: ['scripts/migrate.ts'], outfile: 'dist/migrate.mjs', bundle: true,
  format: 'esm', target: 'node18', platform: 'node',
})
console.log('Built plugin, theme and local migration utility.')
