import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
)

describe('desktop packaging publish policy', () => {
  it.each(['release:windows', 'electron:installer'])(
    'forces %s to build locally without publishing',
    (scriptName) => {
      const command = packageJson.scripts?.[scriptName]
      expect(command).toEqual(expect.any(String))
      expect(command).toMatch(/\belectron-builder\b/)
      expect(command).toMatch(/--publish\s+never\b/)
    },
  )
})
