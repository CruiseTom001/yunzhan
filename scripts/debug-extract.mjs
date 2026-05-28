/**
 * 调试版：测试 docker.ts 的内容提取
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, '../src/data/courses/docker.ts')

const text = fs.readFileSync(filePath, 'utf-8')
const lines = text.split('\n')

console.log(`总行数: ${lines.length}`)

// 找所有包含 content: 的行
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (line.includes('content:')) {
    console.log(`\n行 ${i + 1}: ${line.trim().slice(0, 120)}`)
    
    // 检查匹配
    const match = line.match(/content:\s*`/)
    console.log(`  regex 匹配: ${match ? '✅' : '❌'}`)
    
    if (match) {
      const afterTick = line.slice(line.indexOf('`') + 1)
      const endsSameLine = line.trimEnd().endsWith('`,')
      console.log(`  本行结束: ${endsSameLine ? '✅' : '❌'}`)
      console.log(`  后续字符数: ${afterTick.length}`)
    }
  }
}
