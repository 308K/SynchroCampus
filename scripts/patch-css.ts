// 构建后 CSS 补丁：lightningcss 会把 backdrop-filter 剥得只剩 -webkit- 别名，
// Firefox 等不认该别名的引擎会丢失毛玻璃效果。此脚本在每条 -webkit-backdrop-filter
// 声明后补回无前缀标准属性（幂等：已存在则跳过）。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = 'dist/assets'
let patched = 0

for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
  const path = `${dir}/${file}`
  let css = readFileSync(path, 'utf8')
  css = css.replace(/-webkit-backdrop-filter:([^;}]+);/g, (match, value) => {
    patched++
    return `${match}backdrop-filter:${value};`
  })
  writeFileSync(path, css)
}

console.log(`[patch-css] restored unprefixed backdrop-filter × ${patched}`)
