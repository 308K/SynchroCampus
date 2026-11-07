// 检查构建产物中的关键 CSS 规则（一次性诊断脚本）
import { readdirSync, readFileSync } from 'node:fs'

const dir = 'dist/assets'
const cssFile = readdirSync(dir).find((f) => f.endsWith('.css'))
const css = readFileSync(`${dir}/${cssFile}`, 'utf8')

const ldCount = (css.match(/light-dark\(/g) || []).length
const lvCount = (css.match(/--lightningcss/g) || []).length
const headerMatch = css.match(/\.mantine-AppShell-header\{[^}]*\}/)
const unprefixed = headerMatch ? (headerMatch[0].match(/(?<!-)backdrop-filter/g) || []).length : 0

console.log(`file: ${cssFile}`)
console.log(`light-dark() remaining: ${ldCount}`)
console.log(`--lightningcss vars: ${lvCount}`)
console.log(`header rule: ${headerMatch ? headerMatch[0] : 'NOT FOUND'}`)
console.log(`unprefixed backdrop-filter in rule: ${unprefixed}`)
