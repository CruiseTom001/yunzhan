import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(path.join(root, 'public', 'favicon.svg'))
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = await Promise.all(
  sizes.map(size => sharp(source).resize(size, size).png().toBuffer()),
)
const icon = await pngToIco(images)
await writeFile(path.join(root, 'public', 'icon.ico'), icon)

console.log('[icon] Generated public/icon.ico')
