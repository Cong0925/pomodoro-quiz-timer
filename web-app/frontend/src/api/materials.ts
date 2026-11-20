/**
 * 资料管理 API
 * - JSON 请求复用 http 封装
 * - 文件上传使用 multipart，单独用 XHR 以获取上传进度
 * - 下载直接走 /api/materials/:id/download，由浏览器接管
 */
import { http } from './http'
import type {
  MaterialCategory,
  MaterialCategoryCount,
  MaterialFolder,
  MaterialItem,
  MaterialListResult,
  MaterialPreviewType,
} from '../types'

export interface MaterialListParams {
  q?: string
  folderId?: number | 'all' | 'none'
  type?: MaterialPreviewType | 'all'
  category?: MaterialCategory | 'all'
  page?: number
  limit?: number
}

export interface MaterialUpdatePayload {
  title: string
  description: string
  folderId: number | null
  category?: MaterialCategory
}

function buildQuery(params: MaterialListParams): string {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.folderId !== undefined && params.folderId !== 'all') {
    sp.set('folderId', String(params.folderId))
  }
  if (params.type && params.type !== 'all') sp.set('type', params.type)
  if (params.category && params.category !== 'all') sp.set('category', params.category)
  if (params.page) sp.set('page', String(params.page))
  if (params.limit) sp.set('limit', String(params.limit))
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const materialsApi = {
  list: (params: MaterialListParams = {}) =>
    http.get<MaterialListResult>(`/materials${buildQuery(params)}`),

  folders: () => http.get<MaterialFolder[]>('/materials/folders'),

  categories: (folderId?: number | 'all' | 'none') => {
    const qs = folderId !== undefined && folderId !== 'all'
      ? `?folderId=${encodeURIComponent(String(folderId))}`
      : ''
    return http.get<MaterialCategoryCount[]>(`/materials/categories${qs}`)
  },

  createFolder: (name: string) =>
    http.post<{ id: number; name: string }>('/materials/folders', { name }),

  renameFolder: (id: number, name: string) =>
    http.put<{ ok: true }>(`/materials/folders/${id}`, { name }),

  deleteFolder: (id: number) =>
    http.del<{ ok: true }>(`/materials/folders/${id}`),

  detail: (id: number) => http.get<MaterialItem>(`/materials/${id}`),

  update: (id: number, payload: MaterialUpdatePayload) =>
    http.put<{ ok: true }>(`/materials/${id}`, payload),

  moveFolder: (id: number, folderId: number | null) =>
    http.put<{ ok: true; folderId: number | null }>(`/materials/${id}/folder`, { folderId }),

  updateCategory: (id: number, category: MaterialCategory) =>
    http.put<{ ok: true; category: MaterialCategory; categoryLabel: string }>(
      `/materials/${id}/category`,
      { category },
    ),

  remove: (id: number) => http.del<{ ok: true }>(`/materials/${id}`),

  touchView: (id: number) => http.post<{ ok: true }>(`/materials/${id}/view`),
}

export interface UploadMaterialPayload {
  files: File[]
  title?: string
  description: string
  folderId: number | null
  /** auto 按文件名自动识别，其余整批指定 */
  category?: MaterialCategory | 'auto'
}

export interface UploadMaterialResult {
  list: MaterialItem[]
  count: number
}

/** multipart 批量上传，返回上传进度回调（0-100） */
export function uploadMaterial(
  payload: UploadMaterialPayload,
  onProgress?: (percent: number) => void,
): Promise<UploadMaterialResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    payload.files.forEach(file => form.append('files', file))
    if (payload.title) form.append('title', payload.title)
    form.append('description', payload.description)
    if (payload.folderId !== null) form.append('folderId', String(payload.folderId))
    if (payload.category) form.append('category', payload.category)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/materials')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onerror = () => reject(new Error('网络异常，上传失败'))
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // 非 JSON 响应
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        const result = body as UploadMaterialResult
        if (Array.isArray(result.list)) {
          resolve(result)
          return
        }
      }
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `上传失败（HTTP ${xhr.status}）`
      reject(new Error(message))
    }
    xhr.send(form)
  })
}

/** 文件对外 URL：数据库存逻辑路径，开发时经 Vite proxy 转发 */
export function materialUrl(item: MaterialItem): string {
  return item.filePath || item.fileUrl
}

export function downloadUrl(id: number): string {
  return `/api/materials/${id}/download`
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}
