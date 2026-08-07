import { describe, expect, it } from 'vitest'
import { formatAiModelDisplayName } from './aiModelDisplay'

describe('formatAiModelDisplayName', () => {
  it('uses friendly labels for configured models', () => {
    expect(formatAiModelDisplayName('z-ai/glm-5.2')).toBe('GLM 5.2')
    expect(formatAiModelDisplayName('minimaxai/minimax-m3')).toBe('MiniMAX M3')
  })

  it('humanizes future provider model identifiers', () => {
    expect(formatAiModelDisplayName('provider/future-model_v1')).toBe('Future Model V1')
  })

  it('handles empty values safely', () => {
    expect(formatAiModelDisplayName('  ')).toBe('未配置')
  })
})
