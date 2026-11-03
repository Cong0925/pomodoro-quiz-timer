import { API_BASE_URL } from '@/config'
import { getToken } from '@/utils/token'

/** 后端统一响应包（骨架默认结构，后端对接时按实际响应调整） */
interface ApiEnvelope<T> {
  code?: number
  msg?: string
  data?: T
}

interface RequestOptions {
  /** 接口路径（不含域名，如 /api/practice/questions） */
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  /** 是否携带登录态 token，默认 true */
  auth?: boolean
  /** 是否自动弹出错误提示，默认 true */
  showError?: boolean
}

/**
 * 统一请求封装：token 注入、超时、错误提示、中文异常日志
 * @param options 请求配置
 * @returns 后端响应 data 部分
 */
export function request<T = unknown>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.request({
      url: API_BASE_URL + options.url,
      method: options.method ?? 'GET',
      data: options.data ?? {},
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(options.auth !== false && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data as ApiEnvelope<T>
          if (body && typeof body === 'object' && 'code' in body && body.code !== undefined && body.code !== 0) {
            const msg = body.msg || '请求失败'
            console.warn(`【接口业务错误】${options.url} code=${body.code}`, body)
            if (options.showError !== false) {
              uni.showToast({ title: msg, icon: 'none' })
            }
            reject(new Error(msg))
            return
          }
          resolve(body && 'data' in body ? (body.data as T) : (body as T))
          return
        }
        const errMsg = `接口异常 HTTP ${res.statusCode}`
        console.error(`【接口请求失败】${options.url}`, res.statusCode, res.data)
        if (options.showError !== false) {
          uni.showToast({ title: '请求失败，请稍后重试', icon: 'none' })
        }
        reject(new Error(errMsg))
      },
      fail: (err) => {
        console.error(`【网络请求失败】${options.url}`, err)
        if (options.showError !== false) {
          uni.showToast({ title: '网络异常，请检查连接', icon: 'none' })
        }
        reject(new Error('网络异常'))
      },
    })
  })
}
