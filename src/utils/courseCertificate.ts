export interface CourseCertificateData {
  learnerName: string
  courseTitle: string
  completedChapters: number
  studyTimeLabel: string
  streakDays: number
  completedDate: string
  certificateId: string
}

const CERTIFICATE_WIDTH = 1400
const CERTIFICATE_HEIGHT = 900

function drawGrid(context: CanvasRenderingContext2D) {
  context.save()
  context.strokeStyle = 'rgba(148, 163, 184, 0.08)'
  context.lineWidth = 1
  for (let x = 70; x < CERTIFICATE_WIDTH; x += 70) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, CERTIFICATE_HEIGHT)
    context.stroke()
  }
  for (let y = 60; y < CERTIFICATE_HEIGHT; y += 60) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(CERTIFICATE_WIDTH, y)
    context.stroke()
  }
  context.restore()
}

function drawCornerMark(context: CanvasRenderingContext2D, x: number, y: number, scaleX: number, scaleY: number) {
  context.save()
  context.translate(x, y)
  context.scale(scaleX, scaleY)
  context.strokeStyle = '#22d3ee'
  context.lineWidth = 5
  context.beginPath()
  context.moveTo(0, 90)
  context.lineTo(0, 0)
  context.lineTo(90, 0)
  context.stroke()
  context.restore()
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  color: string,
) {
  context.font = font
  context.fillStyle = color
  context.textAlign = 'center'
  context.fillText(text, CERTIFICATE_WIDTH / 2, y)
}

function createCertificateCanvas(data: CourseCertificateData) {
  const canvas = document.createElement('canvas')
  canvas.width = CERTIFICATE_WIDTH
  canvas.height = CERTIFICATE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前环境无法创建证书画布。')
  }

  context.fillStyle = '#070b12'
  context.fillRect(0, 0, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT)
  drawGrid(context)

  context.strokeStyle = 'rgba(34, 211, 238, 0.32)'
  context.lineWidth = 2
  context.strokeRect(34, 34, CERTIFICATE_WIDTH - 68, CERTIFICATE_HEIGHT - 68)
  context.strokeStyle = 'rgba(52, 211, 153, 0.18)'
  context.strokeRect(50, 50, CERTIFICATE_WIDTH - 100, CERTIFICATE_HEIGHT - 100)

  drawCornerMark(context, 72, 72, 1, 1)
  drawCornerMark(context, CERTIFICATE_WIDTH - 72, 72, -1, 1)
  drawCornerMark(context, 72, CERTIFICATE_HEIGHT - 72, 1, -1)
  drawCornerMark(context, CERTIFICATE_WIDTH - 72, CERTIFICATE_HEIGHT - 72, -1, -1)

  drawCenteredText(context, 'YUNZHAN · 云栈', 150, '700 28px Consolas, monospace', '#67e8f9')
  drawCenteredText(context, '课程通关证书', 245, '700 58px "Microsoft YaHei", sans-serif', '#f8fafc')
  drawCenteredText(context, 'COURSE COMPLETION CERTIFICATE', 292, '500 20px Consolas, monospace', '#94a3b8')

  drawCenteredText(context, '兹证明', 370, '400 24px "Microsoft YaHei", sans-serif', '#94a3b8')
  drawCenteredText(context, data.learnerName, 430, '700 40px "Microsoft YaHei", sans-serif', '#34d399')
  drawCenteredText(context, `已完成「${data.courseTitle}」全部课程`, 495, '500 30px "Microsoft YaHei", sans-serif', '#e2e8f0')

  const summaryY = 610
  const summaryItems = [
    { label: '完成章节', value: `${data.completedChapters} 章` },
    { label: '累计学习', value: data.studyTimeLabel },
    { label: '连续学习', value: `${data.streakDays} 天` },
  ]
  summaryItems.forEach((item, index) => {
    const x = 350 + index * 350
    context.fillStyle = 'rgba(15, 23, 42, 0.88)'
    context.fillRect(x - 135, summaryY - 55, 270, 120)
    context.strokeStyle = index === 1 ? 'rgba(251, 191, 36, 0.28)' : 'rgba(34, 211, 238, 0.2)'
    context.strokeRect(x - 135, summaryY - 55, 270, 120)
    context.textAlign = 'center'
    context.font = '400 18px "Microsoft YaHei", sans-serif'
    context.fillStyle = '#94a3b8'
    context.fillText(item.label, x, summaryY - 12)
    context.font = '700 26px "Microsoft YaHei", sans-serif'
    context.fillStyle = '#f8fafc'
    context.fillText(item.value, x, summaryY + 32)
  })

  context.textAlign = 'left'
  context.font = '400 17px "Microsoft YaHei", sans-serif'
  context.fillStyle = '#94a3b8'
  context.fillText(`完成日期：${data.completedDate}`, 100, 790)
  context.textAlign = 'right'
  context.fillText(`证书编号：${data.certificateId}`, CERTIFICATE_WIDTH - 100, 790)
  drawCenteredText(context, '从命令行出发，抵达工程实践', 846, '400 18px "Microsoft YaHei", sans-serif', '#64748b')

  return canvas
}

export async function createCourseCertificateBlob(data: CourseCertificateData): Promise<Blob> {
  if ('fonts' in document) {
    await document.fonts.ready
  }
  const canvas = createCertificateCanvas(data)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('证书图片生成失败。'))
      }
    }, 'image/png')
  })
}

export function getCertificateFileName(courseTitle: string) {
  const printableTitle = Array.from(courseTitle)
    .filter(character => character.charCodeAt(0) >= 32)
    .join('')
  const safeTitle = printableTitle
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return `云栈-${safeTitle || '课程'}-通关证书.png`
}

export function downloadCertificateBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
