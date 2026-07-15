const SEMVER_RE = /^\d+\.\d+\.\d+$/

/** 判断是否为 x.y.z 形式纯数字语义版本号 */
export function isSemver(value: string): boolean {
  return SEMVER_RE.test(value)
}

function parseParts(version: string): [number, number, number] {
  if (!isSemver(version)) throw new Error(`无效语义版本号:${version}`)
  const [major, minor, patch] = version.split('.')
  return [Number(major), Number(minor), Number(patch)]
}

/**
 * 比较两个语义版本号。
 * @returns -1 / 0 / 1,左小于/等于/大于右
 */
export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseParts(a)
  const [bMajor, bMinor, bPatch] = parseParts(b)
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1
  return 0
}
