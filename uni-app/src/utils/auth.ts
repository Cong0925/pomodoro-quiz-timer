import { request } from '@/utils/request'
import { setToken } from '@/utils/token'

interface LoginResponse {
  token: string
  user: {
    id: number
    nickname: string
    avatar: string
  }
}

/**
 * 静默登录：wx.login 换取 code → 后端 /api/auth/login 换 openid 并签发 token
 * 后端契约：POST /api/auth/login body={ code } → { token, user: { id, nickname, avatar } }
 * 用户体系：users 表 openid 唯一；记录类表按 user_id 隔离；PC 版无 token 默认 user_id=1(root)
 * @returns 是否登录成功
 */
export async function login(): Promise<boolean> {
  try {
    const codeRes = await new Promise<{ code: string }>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve({ code: res.code }),
        fail: (err) => reject(err),
      })
    })
    if (!codeRes.code) {
      console.warn('【静默登录】微信登录未返回 code')
      return false
    }
    const data = await request<LoginResponse>({
      url: '/api/auth/login',
      method: 'POST',
      data: { code: codeRes.code },
      auth: false,
      showError: false,
    })
    if (data && data.token) {
      setToken(data.token)
      return true
    }
    return false
  } catch (err) {
    console.error('【静默登录失败】', err)
    return false
  }
}
