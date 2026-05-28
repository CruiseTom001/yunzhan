<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const props = defineProps<{
  content: string
  language?: string
  readonly?: boolean
  height?: string
}>()

const emit = defineEmits<{
  change: [value: string]
}>()

const editorEl = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

;(self as any).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

// 语言映射
const langMap: Record<string, string> = {
  bash: 'shell',
  sh: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  json: 'json',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  python: 'python',
  nginx: 'nginx',
  sql: 'sql',
  ini: 'ini',
  toml: 'toml',
  md: 'markdown',
}

onMounted(() => {
  if (!editorEl.value) return

  const lang = langMap[props.language || ''] || props.language || 'plaintext'

  editor = monaco.editor.create(editorEl.value, {
    value: props.content,
    language: lang,
    theme: 'vs-dark',
    readOnly: props.readonly,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 12, bottom: 12 },
    wordWrap: 'on',
    tabSize: 2,
  })

  editor.onDidChangeModelContent(() => {
    emit('change', editor?.getValue() || '')
  })
})

watch(() => props.content, (val) => {
  if (editor && val !== editor.getValue()) {
    editor.setValue(val)
  }
})

watch(() => props.language, (lang) => {
  if (editor) {
    monaco.editor.setModelLanguage(
      editor.getModel()!,
      langMap[lang || ''] || lang || 'plaintext'
    )
  }
})
</script>

<template>
  <div
    ref="editorEl"
    class="monaco-editor-wrapper"
    :style="{ height: height || '300px' }"
  ></div>
</template>

<style scoped>
.monaco-editor-wrapper {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
}
</style>
