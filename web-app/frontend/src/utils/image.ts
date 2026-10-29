/**
 * 图片压缩工具（图片题目方案C）
 * 前端 canvas 压缩：缩放长边 + JPEG 质量迭代，目标 ≤ maxKB（默认 300KB）
 * 约定：PNG 透明底转白底（JPEG 不支持透明）；返回 base64 data URL 内嵌存储
 */

export interface CompressResult {
  /** 压缩后的 base64 data URL（image/jpeg） */
  dataUrl: string
  /** 压缩后字节数（base64 长度 × 0.75 估算） */
  size: number
  /** 原始文件字节数 */
  orig: number
  /** 压缩后宽高 */
  width: number
  height: number
}

/** data:image base64 前缀正则（与后端校验一致） */
export const IMG_RE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/

export function isDataImageUrl(s: unknown): s is string {
  return typeof s === 'string' && IMG_RE.test(s)
}

/** base64 字符串长度 → 字节数 */
export function base64Bytes(s: string): number {
  return Math.round(s.length * 0.75)
}

export function fmtKB(bytes: number): string {
  return (bytes / 1024).toFixed(1) + ' KB'
}

/** 压缩单个图片文件：canvas 缩放 + JPEG 质量迭代，目标 ≤ maxKB */
export async function compressImageFile(file: File, maxKB = 300): Promise<CompressResult> {
  const orig = file.size
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('读取图片失败'))
    r.readAsDataURL(file)
  })
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片解析失败，请更换图片'))
    img.src = raw
  })
  /* 长边限制 1000px：图推题干图/选项图足够清晰，显著压缩体积 */
  const MAX_EDGE = 1000
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片压缩')
  /* PNG 透明底转白底（JPEG 不支持透明） */
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  let quality = 0.85
  let dataUrl = ''
  let size = Infinity
  while (size > maxKB * 1024 && quality >= 0.25) {
    dataUrl = canvas.toDataURL('image/jpeg', quality)
    size = base64Bytes(dataUrl)
    quality -= 0.1
  }
  return { dataUrl, size, orig, width: w, height: h }
}
