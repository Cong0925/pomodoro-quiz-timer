/**
 * 登录态 token 本地存取（纯 storage 操作，无业务依赖，供 request/auth 共用）
 */

const TOKEN_KEY = 'pomodoro_token'

/** 读取登录态 token（读取失败返回空串，不阻塞流程） */
export function getToken(): string {
  try {
    const token = uni.getStorageSync(TOKEN_KEY)
    return typeof token === 'string' ? token : ''
  } catch (err) {
    console.error('【登录态读取失败】', err)
    return ''
  }
}

/** 写入登录态 token */
export function setToken(token: string): void {
  try {
    uni.setStorageSync(TOKEN_KEY, token)
  } catch (err) {
    console.error('【登录态写入失败】', err)
  }
}

/** 清除登录态 */
export function clearToken(): void {
  try {
    uni.removeStorageSync(TOKEN_KEY)
  } catch (err) {
    console.error('【登录态清除失败】', err)
  }
}
