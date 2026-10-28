import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
/* 服务式 API 样式：ElMessageBox/ElMessage 不出现在模板中，按需 resolver 不会注入样式，需手动引入 */
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/message/style/css'
import App from './App.vue'
import router from './router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 注册全部 Element Plus 图标（组件本体由 unplugin 按需导入，图标体量小全量注册）
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}

app.mount('#app')
