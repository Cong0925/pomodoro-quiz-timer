import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
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
