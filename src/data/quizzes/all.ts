import { questions as linuxBasics } from './linux-basics'
import { questions as networking } from './networking'
import { questions as webServer } from './web-server'
import { questions as database } from './database'
import { questions as cacheQueue } from './cache-queue'
import { questions as docker } from './docker'
import { questions as kubernetes } from './kubernetes'
import { questions as cicd } from './cicd'
import { questions as monitoring } from './monitoring'
import { questions as automation } from './automation'
import { questions as logging } from './logging'
import { questions as security } from './security'
import { questions as highAvailability } from './high-availability'
import { questions as cloudOps } from './cloud-ops'
import { questions as devopsSre } from './devops-sre'
import { questions as computerBasics } from './computer-basics'
import { questions as git } from './git'
import { questions as pythonOps } from './python-ops'
import { questions as virtualization } from './virtualization'

export const allQuestions = [
  ...linuxBasics,
  ...networking,
  ...webServer,
  ...database,
  ...cacheQueue,
  ...docker,
  ...kubernetes,
  ...cicd,
  ...monitoring,
  ...automation,
  ...logging,
  ...security,
  ...highAvailability,
  ...cloudOps,
  ...devopsSre,
  ...computerBasics,
  ...git,
  ...pythonOps,
  ...virtualization,
]

export function getQuestionsByCategory(categoryId: string) {
  return allQuestions.filter((q) => q.categoryId === categoryId)
}

export function getQuestionCategories() {
  const cats = new Map<string, string>()
  for (const q of allQuestions) {
    if (!cats.has(q.categoryId)) {
      cats.set(q.categoryId, q.categoryId)
    }
  }
  return Array.from(cats.keys())
}
