import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  computeFileSha512Base64,
  parseLatestYml,
  validateReleaseArtifacts,
} from './validate-release-artifacts.mjs'

const tempDirs = []

function createTempReleaseDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yunzhan-release-'))
  tempDirs.push(dir)
  return dir
}

function writeFixture(releaseDir, version, options = {}) {
  const exeName = `yunzhan-setup-${version}.exe`
  const exePath = path.join(releaseDir, exeName)
  const content = options.exeContent ?? `setup-${version}`
  fs.writeFileSync(exePath, content)
  fs.writeFileSync(`${exePath}.blockmap`, 'blockmap')

  const sha512 = options.sha512 ?? computeFileSha512Base64(exePath)
  const size = options.size ?? Buffer.byteLength(content)
  const artifactPath = options.path ?? exeName

  const latestYml = [
    `version: ${version}`,
    `path: ${artifactPath}`,
    `sha512: ${sha512}`,
    `size: ${size}`,
  ].join('\n')
  fs.writeFileSync(path.join(releaseDir, 'latest.yml'), latestYml)

  return { exePath, exeName, sha512, size }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('validate-release-artifacts', () => {
  it('parses latest.yml required fields', () => {
    const parsed = parseLatestYml([
      'version: 1.2.5',
      'path: yunzhan-setup-1.2.5.exe',
      'sha512: abc',
      'size: 123',
    ].join('\n'))
    expect(parsed).toEqual({
      version: '1.2.5',
      path: 'yunzhan-setup-1.2.5.exe',
      sha512: 'abc',
      size: 123,
    })
  })

  it('passes when latest.yml matches exe and blockmap', () => {
    const releaseDir = createTempReleaseDir()
    writeFixture(releaseDir, '1.2.5')
    const result = validateReleaseArtifacts({ releaseDir, expectedVersion: '1.2.5' })
    expect(result.downloadFileName).toBe('yunzhan-setup-1.2.5.exe')
  })

  it('fails when exe is missing', () => {
    const releaseDir = createTempReleaseDir()
    writeFixture(releaseDir, '1.2.5')
    fs.unlinkSync(path.join(releaseDir, 'yunzhan-setup-1.2.5.exe'))
    expect(() => validateReleaseArtifacts({ releaseDir, expectedVersion: '1.2.5' }))
      .toThrow(/安装包不存在/)
  })

  it('fails when blockmap is missing', () => {
    const releaseDir = createTempReleaseDir()
    writeFixture(releaseDir, '1.2.5')
    fs.unlinkSync(path.join(releaseDir, 'yunzhan-setup-1.2.5.exe.blockmap'))
    expect(() => validateReleaseArtifacts({ releaseDir, expectedVersion: '1.2.5' }))
      .toThrow(/blockmap/)
  })

  it('fails when sha512 or size mismatch', () => {
    const releaseDir = createTempReleaseDir()
    writeFixture(releaseDir, '1.2.5', { sha512: 'wrong' })
    expect(() => validateReleaseArtifacts({ releaseDir, expectedVersion: '1.2.5' }))
      .toThrow(/sha512/)

    const releaseDir2 = createTempReleaseDir()
    writeFixture(releaseDir2, '1.2.5', { size: 99999 })
    expect(() => validateReleaseArtifacts({ releaseDir: releaseDir2, expectedVersion: '1.2.5' }))
      .toThrow(/size/)
  })

  it('fails when latest.yml points to wrong filename', () => {
    const releaseDir = createTempReleaseDir()
    writeFixture(releaseDir, '1.2.5', { path: 'wrong-setup-1.2.5.exe' })
    expect(() => validateReleaseArtifacts({ releaseDir, expectedVersion: '1.2.5' }))
      .toThrow(/path=wrong-setup-1.2.5.exe/)
  })
})
