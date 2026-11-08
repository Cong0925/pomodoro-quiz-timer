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
  // 页面显示生命周期预留
});
onHide(() => {
  // 页面隐藏生命周期预留
});
</script>

<style lang="scss">
/* ============================================================
   全局主题 V2：Bento 数据现代 + 玻璃浮层
   - 通用类集中管理，页面私有样式各自 scoped
   - 换肤只改 uni.scss + 本文件
   ============================================================ */

page {
  background-color: $bg-page;
  background-image:
    radial-gradient(120% 70% at 8% 0%, rgba(47, 107, 255, 0.16) 0%, rgba(47, 107, 255, 0) 62%),
    radial-gradient(90% 60% at 100% 4%, rgba(45, 212, 191, 0.12) 0%, rgba(45, 212, 191, 0) 58%);
  background-repeat: no-repeat;
  background-size: 100% 560rpx, 100% 560rpx;
  color: $ink;
  font-size: 28rpx;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC",
    "HarmonyOS Sans", "Microsoft YaHei", sans-serif;
  line-height: 1.5;
  overflow-x: hidden;
}

/* ---- 页面骨架 ---- */
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: $gap-page;
  padding-bottom: 48rpx;
}

/* ---- Hero：内页默认柔光浅色，首页/速算用 hero-strong ---- */
.hero {
  position: relative;
  overflow: hidden;
  padding: 40rpx 36rpx 44rpx;
  border-radius: $radius-lg;
  background: linear-gradient(160deg, #ffffff 0%, #f3f8ff 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.82);
  box-shadow: $shadow-l2;
}

.hero::before {
  content: '';
  position: absolute;
  top: -180rpx;
  right: -120rpx;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(47, 107, 255, 0.16) 0%, rgba(47, 107, 255, 0) 70%);
}

.hero::after {
  content: '';
  position: absolute;
  bottom: -200rpx;
  left: -140rpx;
  width: 320rpx;
  height: 320rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.12) 0%, rgba(45, 212, 191, 0) 70%);
}

.hero > * {
  position: relative;
  z-index: 1;
}

.hero-strong {
  background: $brand-gradient;
  border: none;
  box-shadow: $shadow-btn;
}

.hero-strong::before {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 68%);
}

.hero-strong::after {
  background: radial-gradient(circle, rgba(45, 212, 191, 0.24) 0%, rgba(45, 212, 191, 0) 70%);
}

.hero-badge {
  display: inline-block;
  padding: 8rpx 20rpx;
  border-radius: $radius-full;
  background-color: $brand-50;
  color: $brand-600;
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.hero-title {
  margin-top: 20rpx;
  font-size: $fs-h1;
  font-weight: 800;
  line-height: 1.2;
  color: $ink;
  letter-spacing: -0.5rpx;
}

.hero-sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $ink-3;
  line-height: 1.5;
}

.hero-strong .hero-badge {
  background-color: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.hero-strong .hero-title {
  color: #ffffff;
}

.hero-strong .hero-sub {
  color: rgba(255, 255, 255, 0.82);
}

/* ---- 卡片 ---- */
.card {
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-l2;
  padding: 32rpx;
  box-sizing: border-box;
}

/* ---- Bento ---- */
.bento {
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-l2;
  padding: 32rpx;
  box-sizing: border-box;
}

.bento-hero {
  background: linear-gradient(160deg, #ffffff 0%, #f4f8ff 100%);
}

.bento-stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6rpx;
}

.bento-stat .stat-num {
  font-size: $fs-num;
  font-weight: 800;
  line-height: 1.1;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.bento-stat .stat-label {
  font-size: 22rpx;
  color: $ink-3;
}

.bento-action {
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-l2;
  padding: 26rpx;
  box-sizing: border-box;
}

/* ---- 区块标题 ---- */
.sec {
  margin-top: 48rpx;
}

.sec-title {
  display: flex;
  align-items: center;
  font-size: $fs-h3;
  font-weight: 700;
  color: $ink;
  margin-bottom: 20rpx;
  letter-spacing: -0.2rpx;
}

.sec-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 12rpx;
  margin-right: 12rpx;
  border-radius: $radius-full;
  background-color: $brand-600;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 0;
  box-shadow: 0 6rpx 14rpx rgba(47, 107, 255, 0.22);
}

.sec-count {
  font-size: 22rpx;
  color: $ink-3;
  font-weight: 400;
  margin-left: 12rpx;
}

.sec-link {
  margin-left: auto;
  font-size: 24rpx;
  color: $brand-600;
  font-weight: 600;
}

/* ---- 按钮 ---- */
button {
  font-family: inherit;
}

button::after {
  border: none;
}

button[disabled] {
  opacity: 0.45;
}

.btn-primary {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: $radius-md;
  background: $brand-gradient;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
  border: none;
  box-shadow: $shadow-glow;
  letter-spacing: 1rpx;
  box-sizing: border-box;
  padding: 0 24rpx;
}

.btn-ghost {
  height: 88rpx;
  line-height: 88rpx;
  border: 1rpx solid $line-strong;
  border-radius: $radius-md;
  background-color: $bg-card;
  color: $ink;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: $shadow-l1;
  box-sizing: border-box;
  padding: 0 24rpx;
}

.btn-soft {
  height: 88rpx;
  line-height: 88rpx;
  border: none;
  border-radius: $radius-md;
  background-color: $brand-50;
  color: $brand-600;
  font-size: 30rpx;
  font-weight: 600;
  box-sizing: border-box;
  padding: 0 24rpx;
}

.btn-danger {
  height: 88rpx;
  line-height: 88rpx;
  border: none;
  border-radius: $radius-md;
  background-color: $danger-bg;
  color: $danger;
  font-size: 30rpx;
  font-weight: 600;
  box-sizing: border-box;
  padding: 0 24rpx;
}

/* ---- 选择 chip ---- */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  min-height: 68rpx;
  padding: 0 28rpx;
  border-radius: $radius-full;
  background-color: $bg-card;
  border: 1rpx solid $line;
  font-size: 26rpx;
  color: $ink-2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.chip.active {
  background: $brand-gradient;
  border-color: transparent;
  color: #ffffff;
  font-weight: 700;
  box-shadow: $shadow-glow;
}

/* ---- 分段控件 ---- */
.seg {
  display: flex;
  padding: 6rpx;
  border-radius: $radius-full;
  background-color: $bg-soft;
}

.seg-item {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-full;
  font-size: 26rpx;
  color: $ink-2;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.seg-item.active {
  background-color: #ffffff;
  color: $brand-600;
  font-weight: 700;
  box-shadow: $shadow-l1;
}

/* ---- 玻璃浮层 ---- */
.glass {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.78) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-l2;
  backdrop-filter: blur(24rpx) saturate(160%);
  -webkit-backdrop-filter: blur(24rpx) saturate(160%);
}

/* ---- 进度环（外环背景由页面按进度写 inline conic-gradient） ---- */
.ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: $line;
}

.ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #ffffff;
}

/* ---- 标签 ---- */
.tag {
  display: inline-flex;
  align-items: center;
  height: 40rpx;
  padding: 0 14rpx;
  border-radius: $radius-full;
  background-color: $bg-soft;
  color: $ink-2;
  font-size: 20rpx;
  font-weight: 500;
}

.tag.brand {
  background-color: $brand-50;
  color: $brand-600;
}

.tag.mint {
  background-color: $mint-bg;
  color: $mint;
}

.tag.amber {
  background-color: $amber-bg;
  color: $amber;
}

.tag.danger {
  background-color: $danger-bg;
  color: $danger;
}

/* ---- 按压反馈 ---- */
.press {
  transform: scale(0.97);
  opacity: 0.94;
}

/* ---- 空态 / 占位 ---- */
.empty-box {
  margin-top: 24rpx;
  padding: 64rpx 40rpx;
  border-radius: $radius-lg;
  background-color: $bg-card;
  box-shadow: $shadow-l1;
  text-align: center;
}

.empty-box::before {
  content: '';
  display: block;
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto 22rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #eaf1ff 0%, #dce9ff 100%);
  box-shadow: inset 0 0 0 14rpx #ffffff, 0 10rpx 26rpx rgba(47, 107, 255, 0.12);
}

.empty-title {
  font-size: $fs-h3;
  font-weight: 700;
  color: $ink;
}

.empty-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $ink-3;
  line-height: 1.6;
}

/* ---- 入口箭头 ---- */
.entry-arrow {
  width: 14rpx;
  height: 14rpx;
  border-top: 3rpx solid $ink-3;
  border-right: 3rpx solid $ink-3;
  transform: rotate(45deg);
  flex-shrink: 0;
}

/* ---- 数字排版 ---- */
.num {
  font-variant-numeric: tabular-nums;
}

/* H5 预览：隐藏 uni-app 默认文字 tabBar，改用与小程序一致的玻璃悬浮 tabBar */
/* #ifdef H5 */
.uni-tabbar {
  display: none !important;
}
/* #endif */
</style>
