/**
 * Markdown 内容加载器
 *
 * 使用 Vite 的 ?raw 静态导入。每个 .md 文件单独导入，
 * 再通过索引表直接访问。
 */

// ===== 逐个静态导入（Vite 构建时确定，100% 可靠）=====
import autoCh0 from '@/data/markdown/automation/chapter-0.md?raw'
import autoCh1 from '@/data/markdown/automation/chapter-1.md?raw'
import autoCh2 from '@/data/markdown/automation/chapter-2.md?raw'
import autoCh3 from '@/data/markdown/automation/chapter-3.md?raw'
import autoCh4 from '@/data/markdown/automation/chapter-4.md?raw'
import autoCh5 from '@/data/markdown/automation/chapter-5.md?raw'
import autoCh6 from '@/data/markdown/automation/chapter-6.md?raw'

import cacheCh0 from '@/data/markdown/cache-queue/chapter-0.md?raw'
import cacheCh1 from '@/data/markdown/cache-queue/chapter-1.md?raw'
import cacheCh2 from '@/data/markdown/cache-queue/chapter-2.md?raw'
import cacheCh3 from '@/data/markdown/cache-queue/chapter-3.md?raw'
import cacheCh4 from '@/data/markdown/cache-queue/chapter-4.md?raw'
import cacheCh5 from '@/data/markdown/cache-queue/chapter-5.md?raw'

import cicdCh0 from '@/data/markdown/cicd/chapter-0.md?raw'
import cicdCh1 from '@/data/markdown/cicd/chapter-1.md?raw'
import cicdCh2 from '@/data/markdown/cicd/chapter-2.md?raw'
import cicdCh3 from '@/data/markdown/cicd/chapter-3.md?raw'
import cicdCh4 from '@/data/markdown/cicd/chapter-4.md?raw'
import cicdCh5 from '@/data/markdown/cicd/chapter-5.md?raw'

import cloudCh0 from '@/data/markdown/cloud-ops/chapter-0.md?raw'
import cloudCh1 from '@/data/markdown/cloud-ops/chapter-1.md?raw'
import cloudCh2 from '@/data/markdown/cloud-ops/chapter-2.md?raw'
import cloudCh3 from '@/data/markdown/cloud-ops/chapter-3.md?raw'
import cloudCh4 from '@/data/markdown/cloud-ops/chapter-4.md?raw'

import compCh0 from '@/data/markdown/computer-basics/chapter-0.md?raw'
import compCh1 from '@/data/markdown/computer-basics/chapter-1.md?raw'
import compCh2 from '@/data/markdown/computer-basics/chapter-2.md?raw'
import compCh3 from '@/data/markdown/computer-basics/chapter-3.md?raw'
import compCh4 from '@/data/markdown/computer-basics/chapter-4.md?raw'
import compCh5 from '@/data/markdown/computer-basics/chapter-5.md?raw'

import dbCh0 from '@/data/markdown/database/chapter-0.md?raw'
import dbCh1 from '@/data/markdown/database/chapter-1.md?raw'
import dbCh2 from '@/data/markdown/database/chapter-2.md?raw'
import dbCh3 from '@/data/markdown/database/chapter-3.md?raw'
import dbCh4 from '@/data/markdown/database/chapter-4.md?raw'
import dbCh5 from '@/data/markdown/database/chapter-5.md?raw'
import dbCh6 from '@/data/markdown/database/chapter-6.md?raw'

import devopsCh0 from '@/data/markdown/devops-sre/chapter-0.md?raw'
import devopsCh1 from '@/data/markdown/devops-sre/chapter-1.md?raw'
import devopsCh2 from '@/data/markdown/devops-sre/chapter-2.md?raw'
import devopsCh3 from '@/data/markdown/devops-sre/chapter-3.md?raw'
import devopsCh4 from '@/data/markdown/devops-sre/chapter-4.md?raw'
import devopsCh5 from '@/data/markdown/devops-sre/chapter-5.md?raw'

import dockerCh0 from '@/data/markdown/docker/chapter-0.md?raw'
import dockerCh1 from '@/data/markdown/docker/chapter-1.md?raw'
import dockerCh2 from '@/data/markdown/docker/chapter-2.md?raw'
import dockerCh3 from '@/data/markdown/docker/chapter-3.md?raw'
import dockerCh4 from '@/data/markdown/docker/chapter-4.md?raw'
import dockerCh5 from '@/data/markdown/docker/chapter-5.md?raw'
import dockerCh6 from '@/data/markdown/docker/chapter-6.md?raw'

import gitCh0 from '@/data/markdown/git/chapter-0.md?raw'
import gitCh1 from '@/data/markdown/git/chapter-1.md?raw'
import gitCh2 from '@/data/markdown/git/chapter-2.md?raw'
import gitCh3 from '@/data/markdown/git/chapter-3.md?raw'
import gitCh4 from '@/data/markdown/git/chapter-4.md?raw'
import gitCh5 from '@/data/markdown/git/chapter-5.md?raw'

import haCh0 from '@/data/markdown/high-availability/chapter-0.md?raw'
import haCh1 from '@/data/markdown/high-availability/chapter-1.md?raw'
import haCh2 from '@/data/markdown/high-availability/chapter-2.md?raw'
import haCh3 from '@/data/markdown/high-availability/chapter-3.md?raw'
import haCh4 from '@/data/markdown/high-availability/chapter-4.md?raw'
import haCh5 from '@/data/markdown/high-availability/chapter-5.md?raw'

import k8sCh0 from '@/data/markdown/kubernetes/chapter-0.md?raw'
import k8sCh1 from '@/data/markdown/kubernetes/chapter-1.md?raw'
import k8sCh2 from '@/data/markdown/kubernetes/chapter-2.md?raw'
import k8sCh3 from '@/data/markdown/kubernetes/chapter-3.md?raw'
import k8sCh4 from '@/data/markdown/kubernetes/chapter-4.md?raw'
import k8sCh5 from '@/data/markdown/kubernetes/chapter-5.md?raw'
import k8sCh6 from '@/data/markdown/kubernetes/chapter-6.md?raw'
import k8sCh7 from '@/data/markdown/kubernetes/chapter-7.md?raw'

import linuxCh0 from '@/data/markdown/linux-basics/chapter-0.md?raw'
import linuxCh1 from '@/data/markdown/linux-basics/chapter-1.md?raw'
import linuxCh2 from '@/data/markdown/linux-basics/chapter-2.md?raw'
import linuxCh3 from '@/data/markdown/linux-basics/chapter-3.md?raw'
import linuxCh4 from '@/data/markdown/linux-basics/chapter-4.md?raw'
import linuxCh5 from '@/data/markdown/linux-basics/chapter-5.md?raw'
import linuxCh6 from '@/data/markdown/linux-basics/chapter-6.md?raw'
import linuxCh7 from '@/data/markdown/linux-basics/chapter-7.md?raw'

import logCh0 from '@/data/markdown/logging/chapter-0.md?raw'
import logCh1 from '@/data/markdown/logging/chapter-1.md?raw'
import logCh2 from '@/data/markdown/logging/chapter-2.md?raw'
import logCh3 from '@/data/markdown/logging/chapter-3.md?raw'
import logCh4 from '@/data/markdown/logging/chapter-4.md?raw'
import logCh5 from '@/data/markdown/logging/chapter-5.md?raw'

import monCh0 from '@/data/markdown/monitoring/chapter-0.md?raw'
import monCh1 from '@/data/markdown/monitoring/chapter-1.md?raw'
import monCh2 from '@/data/markdown/monitoring/chapter-2.md?raw'
import monCh3 from '@/data/markdown/monitoring/chapter-3.md?raw'
import monCh4 from '@/data/markdown/monitoring/chapter-4.md?raw'
import monCh5 from '@/data/markdown/monitoring/chapter-5.md?raw'

import netCh0 from '@/data/markdown/networking/chapter-0.md?raw'
import netCh1 from '@/data/markdown/networking/chapter-1.md?raw'
import netCh2 from '@/data/markdown/networking/chapter-2.md?raw'
import netCh3 from '@/data/markdown/networking/chapter-3.md?raw'
import netCh4 from '@/data/markdown/networking/chapter-4.md?raw'
import netCh5 from '@/data/markdown/networking/chapter-5.md?raw'

import pyCh0 from '@/data/markdown/python-ops/chapter-0.md?raw'
import pyCh1 from '@/data/markdown/python-ops/chapter-1.md?raw'
import pyCh2 from '@/data/markdown/python-ops/chapter-2.md?raw'
import pyCh3 from '@/data/markdown/python-ops/chapter-3.md?raw'
import pyCh4 from '@/data/markdown/python-ops/chapter-4.md?raw'
import pyCh5 from '@/data/markdown/python-ops/chapter-5.md?raw'
import pyCh6 from '@/data/markdown/python-ops/chapter-6.md?raw'

import secCh0 from '@/data/markdown/security/chapter-0.md?raw'
import secCh1 from '@/data/markdown/security/chapter-1.md?raw'
import secCh2 from '@/data/markdown/security/chapter-2.md?raw'
import secCh3 from '@/data/markdown/security/chapter-3.md?raw'
import secCh4 from '@/data/markdown/security/chapter-4.md?raw'
import secCh5 from '@/data/markdown/security/chapter-5.md?raw'

import virtCh0 from '@/data/markdown/virtualization/chapter-0.md?raw'
import virtCh1 from '@/data/markdown/virtualization/chapter-1.md?raw'
import virtCh2 from '@/data/markdown/virtualization/chapter-2.md?raw'
import virtCh3 from '@/data/markdown/virtualization/chapter-3.md?raw'
import virtCh4 from '@/data/markdown/virtualization/chapter-4.md?raw'
import virtCh5 from '@/data/markdown/virtualization/chapter-5.md?raw'

import webCh0 from '@/data/markdown/web-server/chapter-0.md?raw'
import webCh1 from '@/data/markdown/web-server/chapter-1.md?raw'
import webCh2 from '@/data/markdown/web-server/chapter-2.md?raw'
import webCh3 from '@/data/markdown/web-server/chapter-3.md?raw'
import webCh5 from '@/data/markdown/web-server/chapter-5.md?raw'
import webCh6 from '@/data/markdown/web-server/chapter-6.md?raw'
import webCh7 from '@/data/markdown/web-server/chapter-7.md?raw'

import projCh0 from '@/data/markdown/devops-project/chapter-0.md?raw'
import projCh1 from '@/data/markdown/devops-project/chapter-1.md?raw'
import projCh2 from '@/data/markdown/devops-project/chapter-2.md?raw'
import projCh3 from '@/data/markdown/devops-project/chapter-3.md?raw'
import projCh4 from '@/data/markdown/devops-project/chapter-4.md?raw'
import projCh5 from '@/data/markdown/devops-project/chapter-5.md?raw'

// ===== 索引表 =====
const contentIndex: Record<string, string> = {
  'automation/chapter-0.md': autoCh0,
  'automation/chapter-1.md': autoCh1,
  'automation/chapter-2.md': autoCh2,
  'automation/chapter-3.md': autoCh3,
  'automation/chapter-4.md': autoCh4,
  'automation/chapter-5.md': autoCh5,
  'automation/chapter-6.md': autoCh6,
  'cache-queue/chapter-0.md': cacheCh0,
  'cache-queue/chapter-1.md': cacheCh1,
  'cache-queue/chapter-2.md': cacheCh2,
  'cache-queue/chapter-3.md': cacheCh3,
  'cache-queue/chapter-4.md': cacheCh4,
  'cache-queue/chapter-5.md': cacheCh5,
  'cicd/chapter-0.md': cicdCh0,
  'cicd/chapter-1.md': cicdCh1,
  'cicd/chapter-2.md': cicdCh2,
  'cicd/chapter-3.md': cicdCh3,
  'cicd/chapter-4.md': cicdCh4,
  'cicd/chapter-5.md': cicdCh5,
  'cloud-ops/chapter-0.md': cloudCh0,
  'cloud-ops/chapter-1.md': cloudCh1,
  'cloud-ops/chapter-2.md': cloudCh2,
  'cloud-ops/chapter-3.md': cloudCh3,
  'cloud-ops/chapter-4.md': cloudCh4,
  'computer-basics/chapter-0.md': compCh0,
  'computer-basics/chapter-1.md': compCh1,
  'computer-basics/chapter-2.md': compCh2,
  'computer-basics/chapter-3.md': compCh3,
  'computer-basics/chapter-4.md': compCh4,
  'computer-basics/chapter-5.md': compCh5,
  'database/chapter-0.md': dbCh0,
  'database/chapter-1.md': dbCh1,
  'database/chapter-2.md': dbCh2,
  'database/chapter-3.md': dbCh3,
  'database/chapter-4.md': dbCh4,
  'database/chapter-5.md': dbCh5,
  'database/chapter-6.md': dbCh6,
  'devops-sre/chapter-0.md': devopsCh0,
  'devops-sre/chapter-1.md': devopsCh1,
  'devops-sre/chapter-2.md': devopsCh2,
  'devops-sre/chapter-3.md': devopsCh3,
  'devops-sre/chapter-4.md': devopsCh4,
  'devops-sre/chapter-5.md': devopsCh5,
  'docker/chapter-0.md': dockerCh0,
  'docker/chapter-1.md': dockerCh1,
  'docker/chapter-2.md': dockerCh2,
  'docker/chapter-3.md': dockerCh3,
  'docker/chapter-4.md': dockerCh4,
  'docker/chapter-5.md': dockerCh5,
  'docker/chapter-6.md': dockerCh6,
  'git/chapter-0.md': gitCh0,
  'git/chapter-1.md': gitCh1,
  'git/chapter-2.md': gitCh2,
  'git/chapter-3.md': gitCh3,
  'git/chapter-4.md': gitCh4,
  'git/chapter-5.md': gitCh5,
  'high-availability/chapter-0.md': haCh0,
  'high-availability/chapter-1.md': haCh1,
  'high-availability/chapter-2.md': haCh2,
  'high-availability/chapter-3.md': haCh3,
  'high-availability/chapter-4.md': haCh4,
  'high-availability/chapter-5.md': haCh5,
  'kubernetes/chapter-0.md': k8sCh0,
  'kubernetes/chapter-1.md': k8sCh1,
  'kubernetes/chapter-2.md': k8sCh2,
  'kubernetes/chapter-3.md': k8sCh3,
  'kubernetes/chapter-4.md': k8sCh4,
  'kubernetes/chapter-5.md': k8sCh5,
  'kubernetes/chapter-6.md': k8sCh6,
  'kubernetes/chapter-7.md': k8sCh7,
  'linux-basics/chapter-0.md': linuxCh0,
  'linux-basics/chapter-1.md': linuxCh1,
  'linux-basics/chapter-2.md': linuxCh2,
  'linux-basics/chapter-3.md': linuxCh3,
  'linux-basics/chapter-4.md': linuxCh4,
  'linux-basics/chapter-5.md': linuxCh5,
  'linux-basics/chapter-6.md': linuxCh6,
  'linux-basics/chapter-7.md': linuxCh7,
  'logging/chapter-0.md': logCh0,
  'logging/chapter-1.md': logCh1,
  'logging/chapter-2.md': logCh2,
  'logging/chapter-3.md': logCh3,
  'logging/chapter-4.md': logCh4,
  'logging/chapter-5.md': logCh5,
  'monitoring/chapter-0.md': monCh0,
  'monitoring/chapter-1.md': monCh1,
  'monitoring/chapter-2.md': monCh2,
  'monitoring/chapter-3.md': monCh3,
  'monitoring/chapter-4.md': monCh4,
  'monitoring/chapter-5.md': monCh5,
  'networking/chapter-0.md': netCh0,
  'networking/chapter-1.md': netCh1,
  'networking/chapter-2.md': netCh2,
  'networking/chapter-3.md': netCh3,
  'networking/chapter-4.md': netCh4,
  'networking/chapter-5.md': netCh5,
  'python-ops/chapter-0.md': pyCh0,
  'python-ops/chapter-1.md': pyCh1,
  'python-ops/chapter-2.md': pyCh2,
  'python-ops/chapter-3.md': pyCh3,
  'python-ops/chapter-4.md': pyCh4,
  'python-ops/chapter-5.md': pyCh5,
  'python-ops/chapter-6.md': pyCh6,
  'security/chapter-0.md': secCh0,
  'security/chapter-1.md': secCh1,
  'security/chapter-2.md': secCh2,
  'security/chapter-3.md': secCh3,
  'security/chapter-4.md': secCh4,
  'security/chapter-5.md': secCh5,
  'virtualization/chapter-0.md': virtCh0,
  'virtualization/chapter-1.md': virtCh1,
  'virtualization/chapter-2.md': virtCh2,
  'virtualization/chapter-3.md': virtCh3,
  'virtualization/chapter-4.md': virtCh4,
  'virtualization/chapter-5.md': virtCh5,
  'web-server/chapter-0.md': webCh0,
  'web-server/chapter-1.md': webCh1,
  'web-server/chapter-2.md': webCh2,
  'web-server/chapter-3.md': webCh3,
  'web-server/chapter-5.md': webCh5,
  'web-server/chapter-6.md': webCh6,
  'web-server/chapter-7.md': webCh7,
  'devops-project/chapter-0.md': projCh0,
  'devops-project/chapter-1.md': projCh1,
  'devops-project/chapter-2.md': projCh2,
  'devops-project/chapter-3.md': projCh3,
  'devops-project/chapter-4.md': projCh4,
  'devops-project/chapter-5.md': projCh5,
}

/**
 * 加载指定课程指定章节的 Markdown 内容
 */
export async function loadChapterContent(courseId: string, chapterIndex: number): Promise<string> {
  const key = `${courseId}/chapter-${chapterIndex}.md`
  const content = contentIndex[key]
  if (!content) {
    console.warn(`[content-loader] 未找到: ${key}`)
    return ''
  }
  return content
}
