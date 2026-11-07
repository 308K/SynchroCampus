// 审计 Bun.build 产物 CSS（对照之前 lightningcss 的坑：light-dark 变量展开、backdrop-filter 剥离）
import { readdirSync, readFileSync } from 'node:fs'

const dir = 'dist/assets'
const cssFile = readdirSync(dir).find((f) => f.endsWith('.css'))!
const css = readFileSync(`${dir}/${cssFile}`, 'utf8')

console.log(`file: ${cssFile} (${(css.length / 1024).toFixed(0)}KB)`)
console.log(`light-dark( count: ${(css.match(/light-dark\(/g) || []).length}`)
console.log(`-webkit-backdrop-filter: ${(css.match(/-webkit-backdrop-filter/g) || []).length}`)
console.log(`unprefixed backdrop-filter: ${(css.match(/(?<!-)backdrop-filter/g) || []).length}`)
const headerRule = css.match(/\.mantine-AppShell-header\{[^}]*\}/)
console.log(`header rule: ${headerRule ? headerRule[0].slice(0, 400) : 'NOT FOUND'}`)
console.log(`mantine hashed classes present (.m_3b16f56b): ${css.includes('.m_3b16f56b')}`)
console.log(`data-mantine-color-scheme selectors: ${(css.match(/data-mantine-color-scheme/g) || []).length}`)

// JS 产物：sitekey 与 import.meta.env 处理
const jsFile = readdirSync(dir).find((f) => f.startsWith('main-') && f.endsWith('.js'))!
const js = readFileSync(`${dir}/${jsFile}`, 'utf8')
console.log(`sitekey default present: ${js.includes('0x4AAAAAAF13JTQAycn2077e')}`)
console.log(`import.meta.env refs left: ${(js.match(/import\.meta\.env/g) || []).length}`)
