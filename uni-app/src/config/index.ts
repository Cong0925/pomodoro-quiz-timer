/**
 * 小程序全局配置
 */

/**
 * 后端 API 地址
 * - 本地开发：web-app 后端（Express + MySQL）默认 8888 端口；
 * - 微信开发者工具需勾选「不校验合法域名」（project.config.json 已设 urlCheck=false）；
 * - 默认 127.0.0.1：微信开发者工具模拟器与后端同机，回环必达；
 * - 真机预览：改为电脑局域网 IP（当前 WiFi 网段 10.10.1.x，IP 变化需同步改）；
 * - 上线需 HTTPS + ICP 备案域名，替换为正式地址。
 */
export const API_BASE_URL = 'http://127.0.0.1:8888'

/** 应用名称 */
export const APP_NAME = '刷题计时器'
