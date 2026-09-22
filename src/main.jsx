import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ═══ 统一启动序列·最早阶段（模块加载即执行，先于一切滚动恢复）═══
// 禁止浏览器在刷新时自行恢复/跳转到旧滚动位置：否则页面会先落在中途板块，
// 把该处 once 入场动画提前消费 → 出现"先跳板块再弹回 + 后续动画消失"。
// 位置统一由 App 的 boot 在创建入场动画之前决定（无动画 immediate 落点）。
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// 刷新视为回到首页：导航点击留下的 #profile / #tianxuan 等 hash 不应跨刷新保留。
// 普通首次打开仍保留 hash 直链能力，只有 navigation.type === 'reload' 时清理。
const isReload = performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload'
if (isReload && window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
// 带 hash 首次直链时先钉住顶部，随后统一交给 App 的 boot 决定落点
if (window.location.hash) window.scrollTo(0, 0)

// 把整个网站挂载到 index.html 里的 #root 容器上
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
