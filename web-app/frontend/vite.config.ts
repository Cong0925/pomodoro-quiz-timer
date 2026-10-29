import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 自动按需导入：template 中直接使用 el-* 组件，无需手动 import
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/components.d.ts',
    }),
  ],
  server: {
    port: 8889,
    // 前后端分离：/api 请求代理到后端 Express 服务
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
      // 行测真题图片库（data/qi-images 静态服务）
      '/qi-bank': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
