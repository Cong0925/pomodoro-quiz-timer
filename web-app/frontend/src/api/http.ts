/**
 * 统一请求封装（fetch）
 * - 自动拼接 /api 前缀（开发环境经 Vite proxy 转发到后端）
 * - 统一 JSON 解析与错误处理
 * - 禁止 any，所有类型显式声明
 */

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/** 后端统一返回体：成功时为业务数据，失败时形如 { error: string } */
interface ErrorBody {
  error?: string
}

const API_PREFIX = '/api'

async function request<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  try {
    const res = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
    if (!res.ok) {
      let message = `请求失败（HTTP ${res.status}）`
      try {
        const errBody = (await res.json()) as ErrorBody
        if (errBody.error) message = errBody.error
      } catch {
        // 响应体不是 JSON 时保留默认提示
      }
      throw new Error(message)
    }
    return (await res.json()) as T
  } catch (e) {
    console.error(`[api] 请求接口失败：${path}`, e)
    throw e
  }
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal): Promise<T> => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
}
