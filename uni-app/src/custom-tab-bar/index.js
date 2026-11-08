/**
 * 自定义悬浮 tabBar（微信原生组件，供基础库按 custom tabBar 机制加载）
 * 选中态由各 tab 页 onShow 通过 this.getTabBar().setData({ selected }) 同步
 */
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: 'home' },
      { pagePath: '/pages/quiz/index', text: '题库', icon: 'book' },
      { pagePath: '/pages/mental/index', text: '速算', icon: 'bolt' },
      { pagePath: '/pages/profile/index', text: '我的', icon: 'user' }
    ]
  },
  methods: {
    onTap(e) {
      const i = e.currentTarget.dataset.index
      const item = this.data.list[i]
      const pages = getCurrentPages()
      const cur = pages.length ? '/' + (pages[pages.length - 1].route || '') : ''
      if (item.pagePath === cur) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
