/**
 * 修复：给所有的 content: '' 补充缺失的逗号
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COURSES_DIR = path.resolve(__dirname, '../src/data/courses')

const files = fs.readdirSync(COURSES_DIR)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'all.ts')

let fixedCount = 0
for (const file of files) {
  const filePath = path.join(COURSES_DIR, file)
  let text = fs.readFileSync(filePath, 'utf-8')
  if (!text.includes('contentFile:')) continue
  const fixed = text.replace(/content: ''\n(\s*)keyConcepts:/g, "content: '',\n$1keyConcepts:")
  if (fixed !== text) {
    fs.writeFileSync(filePath, fixed, 'utf-8')
    console.log(`✅ ${file}`)
    fixedCount++
  } else {
    console.log(`✓ ${file} (OK)`)
  }
}
console.log(`\n=== 修复了 ${fixedCount} 个文件 ===`)
