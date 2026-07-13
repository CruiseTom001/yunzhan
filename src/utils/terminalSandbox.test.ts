import { describe, expect, it } from 'vitest'
import { executeSandboxCommand } from './terminalSandbox'

describe('terminal sandbox', () => {
  it('returns a non-zero exit code for unknown commands', () => {
    const result = executeSandboxCommand('definitely-not-a-command')

    expect(result.exitCode).toBe(127)
    expect(result.output).toContain('未找到命令')
  })

  it('supports inline comments without treating them as arguments', () => {
    executeSandboxCommand('cd /etc # enter config directory')

    expect(executeSandboxCommand('pwd').output).toBe('/etc')
  })

  it('returns realistic HTTP response headers', () => {
    const result = executeSandboxCommand('curl -I http://localhost')

    expect(result.exitCode ?? 0).toBe(0)
    expect(result.output).toContain('HTTP/1.1 200 OK')
    expect(result.output).toContain('Server: nginx')
  })

  it('supports the Python health-check lab', () => {
    const result = executeSandboxCommand('python health_check.py')

    expect(result.output).toContain('status=healthy')
    expect(result.output).toContain('memory_percent=')
  })
})
