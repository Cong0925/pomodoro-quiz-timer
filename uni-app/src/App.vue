<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { login } from "@/utils/auth";

onLaunch(() => {
  // 静默登录：失败不阻塞使用（未登录仅影响记录归属，题库读取不受限）
  login().then((ok) => {
    if (!ok) {
      console.warn("【应用启动】静默登录未完成，继续匿名使用");
    }
  });
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>

<style>
/* 全局样式：页面统一浅灰底 */
page {
  background-color: #f5f6fa;
}
</style>
