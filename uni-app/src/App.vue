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

<style lang="scss">
/* ============================================================
   全局主题（模块化设计系统，与 uni.scss tokens 配套）
   通用类集中管理：调整视觉只改这里 + uni.scss，页面私有类各自 scoped
   ============================================================ */

page {
  background-color: $bg-page;
  color: $text-main;
  font-size: 28rpx;
  font-family: -apple-system, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.5;
  /* 全局硬约束：禁止横向滚动 */
  overflow-x: hidden;
}

/* ---- 页面骨架 ---- */
.page {
  padding: $gap-page;
  padding-bottom: 48rpx;
  box-sizing: border-box;
  min-height: 100vh;
}

/* ---- 渐变主视觉（页面头部通用） ---- */
.hero {
  padding: 44rpx 40rpx 50rpx;
  border-radius: $radius-lg;
  background: $brand-gradient;
  box-shadow: $shadow-btn;
  overflow: hidden;
}

.hero-badge {
  display: inline-block;
  padding: 8rpx 20rpx;
  border-radius: $radius-full;
  background-color: rgba(255, 255, 255, 0.18);
  color: $brand-100;
  font-size: 22rpx;
  letter-spacing: 2rpx;
}

.hero-title {
  margin-top: 22rpx;
  font-size: 52rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 4rpx;
}

.hero-sub {
  margin-top: 10rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* ---- 卡片（白底 + 大圆角 + 轻阴影，替代细边框模板感） ---- */
.card {
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
}

/* ---- 区块标题 ---- */
.sec {
  margin-top: $gap-sec;
}

.sec-title {
  display: flex;
  align-items: baseline;
  font-size: $fs-title;
  font-weight: 700;
  color: $text-main;
  margin-bottom: 18rpx;
}

.sec-no {
  font-size: 22rpx;
  font-weight: 800;
  color: $brand-400;
  margin-right: 12rpx;
}

/* ---- 按钮 ---- */
button::after {
  border: none;
}

.btn-primary {
  width: 100%;
  height: 100rpx;
  line-height: 100rpx;
  border-radius: $radius-md;
  background: $brand-gradient;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 700;
  border: none;
  box-shadow: $shadow-btn;
  letter-spacing: 2rpx;
}

.btn-ghost {
  height: 96rpx;
  line-height: 96rpx;
  border: 3rpx solid $line;
  border-radius: $radius-md;
  background-color: $bg-card;
  color: $text-main;
  font-size: 31rpx;
  font-weight: 600;
  box-shadow: $shadow-card-sm;
}

/* ---- 选择 chip ---- */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  min-height: 68rpx;
  padding: 12rpx 34rpx;
  border-radius: $radius-full;
  background-color: $bg-card;
  border: 2rpx solid $line;
  font-size: 27rpx;
  color: $text-sub;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-card-sm;
}

.chip.active {
  background: $brand-gradient;
  border-color: transparent;
  color: #ffffff;
  font-weight: 600;
  box-shadow: $shadow-primary;
}

/* ---- 空态 / 占位（占位页与空列表共用） ---- */
.empty-box {
  margin-top: $gap-sec;
  padding: 72rpx 40rpx;
  border-radius: $radius-lg;
  background-color: $bg-card;
  box-shadow: $shadow-card;
  text-align: center;
}

.empty-title {
  font-size: $fs-title;
  font-weight: 700;
  color: $text-main;
}

.empty-text {
  margin-top: 12rpx;
  font-size: $fs-sub;
  color: $text-weak;
  line-height: 1.6;
}

/* ---- 入口箭头（列表/卡片通用） ---- */
.entry-arrow {
  width: 14rpx;
  height: 14rpx;
  border-top: 4rpx solid $text-weak;
  border-right: 4rpx solid $text-weak;
  transform: rotate(45deg);
  flex-shrink: 0;
}
</style>
