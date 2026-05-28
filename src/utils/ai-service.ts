/**
 * AI 助教服务 — DeepSeek API 集成
 *
 * 功能：
 * 1. 命令解释 — 解析 Linux/Docker/K8s 命令
 * 2. 报错分析 — 诊断错误信息并给出修复方案
 * 3. YAML 分析 — 解释 K8s/Docker Compose 配置
 * 4. 学习问答 — 回答云计算相关问题
 */

import { extractCommand, lookupCommand } from './explainer'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  content: string
  error?: string
}

const API_URL = 'https://api.deepseek.com/v1/chat/completions'

// 从 localStorage 读取 API Key
function getApiKey(): string {
  return localStorage.getItem('ai-api-key') || ''
}

export function setApiKey(key: string) {
  localStorage.setItem('ai-api-key', key)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

async function callAI(messages: ChatMessage[]): Promise<AIResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { content: '', error: '请先配置 DeepSeek API Key' }
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.5,
        max_tokens: 1500,
        stream: false,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { content: '', error: `API 错误: ${response.status} — ${err.slice(0, 100)}` }
    }

    const data = await response.json()
    return { content: data.choices?.[0]?.message?.content || '' }
  } catch (e: any) {
    return { content: '', error: `网络错误: ${e.message}` }
  }
}

// ===== 1. 命令解释 =====

function localCommandExplanation(command: string): string | null {
  const commandName = extractCommand(command)
  const explanation = commandName ? lookupCommand(commandName) : null
  if (!explanation) return null

  const options = explanation.options
    ? Object.entries(explanation.options)
        .map(([option, desc]) => `- \`${option}\`：${desc}`)
        .join('\n')
    : '- 暂无预置参数说明'

  const examples = explanation.examples?.length
    ? explanation.examples.map(example => `- \`${example}\``).join('\n')
    : '- 可以在课程代码块中点击“运行”发送到实验终端练习'

  return `## 本地命令解释：${explanation.command}

${explanation.summary}

${explanation.description}

## 常用选项
${options}

## 实战示例
${examples}

> 当前未配置 DeepSeek API Key，以上内容来自云栈内置命令库。配置 Key 后可获得更完整的上下文分析。`
}

export async function explainCommand(command: string): Promise<AIResponse> {
  if (!hasApiKey()) {
    const local = localCommandExplanation(command)
    if (local) return { content: local }
    return {
      content: '',
      error: '请先配置 DeepSeek API Key。这个命令暂未收录到本地命令库。',
    }
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是云计算运维专家助教。用户输入一条 Linux/Docker/K8s 命令，请你：

1. 逐部分解释命令含义
2. 说明每个参数的作用
3. 给出 2-3 个使用场景
4. 标注常见陷阱

用简洁的中文回答，格式清晰。`,
    },
    {
      role: 'user',
      content: `解释这条命令：${command}`,
    },
  ]
  return callAI(messages)
}

// ===== 2. 报错分析 =====

export async function analyzeError(errorText: string, context?: string): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是云计算运维专家。用户遇到了一个错误，请你诊断问题并给出解决方案。

格式：
## 错误原因
简短说明

## 修复方案
1. 步骤一
2. 步骤二

## 预防措施
- 建议一
- 建议二`,
    },
    {
      role: 'user',
      content: `我遇到了这个错误：${errorText}${context ? `\n\n操作环境：${context}` : ''}`,
    },
  ]
  return callAI(messages)
}

// ===== 3. YAML 分析 =====

export async function analyzeYAML(yaml: string, type: 'docker-compose' | 'kubernetes' | 'ansible' = 'docker-compose'): Promise<AIResponse> {
  const typeLabels: Record<string, string> = {
    'docker-compose': 'Docker Compose',
    'kubernetes': 'Kubernetes',
    'ansible': 'Ansible',
  }
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是 ${typeLabels[type]} 配置专家。分析以下 YAML：

1. 解释每个核心字段
2. 标注不推荐或过时的配置
3. 给出安全性和性能优化建议`,
    },
    {
      role: 'user',
      content: `分析这段 ${typeLabels[type]} 配置：\n\n\`\`\`yaml\n${yaml}\n\`\`\``,
    },
  ]
  return callAI(messages)
}

// ===== 4. 学习问答 =====

const QA_SYSTEM_PROMPT = `你是云栈（YunZhan）学习平台的 AI 助教。你的知识领域包括：
- Linux 系统管理（文件系统、权限、进程、网络、磁盘）
- Docker/容器技术
- Kubernetes
- Nginx/Web 服务器
- MySQL/Redis 数据库
- Prometheus/Grafana 监控
- DevOps/CI/CD
- Shell 脚本
- Python 运维编程

回答风格：
- 先一句话总结，再展开
- 结合项目实战案例
- 给出命令示例
- 用通俗语言解释复杂概念
- 如果问题超出你的知识范围，诚实说明`

export async function askQuestion(question: string): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    { role: 'system', content: QA_SYSTEM_PROMPT },
    { role: 'user', content: question },
  ]
  return callAI(messages)
}

// ===== 5. 流式回答 =====

export async function* streamAsk(question: string): AsyncGenerator<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    yield '请先配置 DeepSeek API Key'
    return
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: QA_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    }),
  })

  if (!response.ok) {
    yield `API 错误: ${response.status}`
    return
  }

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // Ignore malformed streaming chunks and continue reading later chunks.
        }
      }
    }
  }
}
