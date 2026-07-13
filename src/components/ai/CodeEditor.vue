<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js'

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
let changeSubscription: monaco.IDisposable | null = null

globalThis.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

const langMap: Record<string, string> = {
  bash: 'shell',
  sh: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
}

function resolveLanguage(language?: string): string {
  if (!language) return 'plaintext'
  return langMap[language.toLowerCase()] ?? 'plaintext'
}

onMounted(() => {
  if (!editorEl.value) return

  editor = monaco.editor.create(editorEl.value, {
    value: props.content,
    language: resolveLanguage(props.language),
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

  changeSubscription = editor.onDidChangeModelContent(() => {
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
    const model = editor.getModel()
    if (model) monaco.editor.setModelLanguage(model, resolveLanguage(lang))
  }
})

onUnmounted(() => {
  changeSubscription?.dispose()
  changeSubscription = null
  editor?.dispose()
  editor = null
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
