import type { Course, LabTask, QuizQuestion } from '@/types'

export interface KnowledgePluginEntry {
  term: string
  aliases?: string[]
  definition: string
  category: string
}

export interface YunzhanPlugin {
  id: string
  name: string
  version: string
  register: (api: PluginApi) => void
}

export interface PluginApi {
  registerCourse: (course: Course) => void
  registerLab: (lab: LabTask) => void
  registerQuiz: (quiz: QuizQuestion) => void
  registerKnowledge: (entry: KnowledgePluginEntry) => void
}

const pluginCourses: Course[] = []
const pluginLabs: LabTask[] = []
const pluginQuizzes: QuizQuestion[] = []
const pluginKnowledge: KnowledgePluginEntry[] = []
const installedPlugins = new Map<string, YunzhanPlugin>()

export const pluginApi: PluginApi = {
  registerCourse(course) {
    pluginCourses.push(course)
  },
  registerLab(lab) {
    pluginLabs.push(lab)
  },
  registerQuiz(quiz) {
    pluginQuizzes.push(quiz)
  },
  registerKnowledge(entry) {
    pluginKnowledge.push(entry)
  },
}

export function installPlugin(plugin: YunzhanPlugin) {
  if (installedPlugins.has(plugin.id)) return
  plugin.register(pluginApi)
  installedPlugins.set(plugin.id, plugin)
}

export function getPluginCourses() {
  return [...pluginCourses]
}

export function getPluginLabs() {
  return [...pluginLabs]
}

export function getPluginQuizzes() {
  return [...pluginQuizzes]
}

export function getPluginKnowledge() {
  return [...pluginKnowledge]
}

export function getInstalledPlugins() {
  return Array.from(installedPlugins.values()).map(plugin => ({
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
  }))
}
