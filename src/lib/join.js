import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { revealCard } from './animations'
import { replayChoreoSection } from './choreo'

gsap.registerPlugin(ScrollTrigger)

/* ════════════════════════════════════════════════════════════
 * 动效收尾 —— 四处交互接缝（join.js）
 *   一、页内锚点平滑跳转（Lenis scrollTo + 目标区入场重放）
 *   二、Tab 面板切换过渡（旧淡出/新错峰、指示器滑动）
 *   三、移动端触屏反馈（按压 + 轻量光晕脉冲，hover:none 才启用）
 *   四、首屏加载时序保护（fonts.ready + 资源 3s 兜底 + 剑光线）
 * 约束：只改 transform/opacity；reduced-motion 一律降级直跳
 * ════════════════════════════════════════════════════════════ */

const isReduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isTouch = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches

/* 简易 easeInOutCubic 1.4s：传给 lenis.scrollTo */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/* ──────────────────────────────────────────────────────────
 * 一、页内锚点平滑跳转
 *   接管全站 a[href^="#"]：preventDefault → lenis.scrollTo(target)
 *   偏移 -80px；到达后重放目标区块入场（数字 countUp / 卡片 revealCard）
 * ────────────────────────────────────────────────────────── */

/** 重放目标区块的入场：数字重新滚动、未绑定卡片重新错峰 */
function replaySectionReveals(section) {
  if (isReduce() || !section) return
  // 已被 choreo 接管编排的板块（档案/天选/征神）：交给 choreo 重放整条时间轴
  if (section.dataset.choreo) {
    replayChoreoSection(section)
    return
  }
  // 1. 数字重新滚动（data-count 静态数字 + .stat-card-value 动态数字）
  section.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count)
    if (Number.isNaN(target)) return
    // 重新从 0 滚：kill 旧 tween 再播
    gsap.killTweensOf(el)
    const obj = { v: 0 }
    gsap.to(obj, {
      v: target, duration: 1.4, ease: 'power2.out',
      onUpdate: () => {
        const gi = Math.round(obj.v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        el.textContent = gi
      },
    })
  })
  // 2. 未入场的卡片重新做中心展开（去 bound 标记后可重绑定）
  section.querySelectorAll('[data-reveal-group]').forEach((group) => {
    const cards = Array.from(group.children).filter(
      (c) => c.dataset.reveal !== 'none' && !c.hasAttribute('data-reveal-group')
    )
    if (!cards.length) return
    cards.forEach((card) => {
      // 先 kill 该卡片上已有的 ScrollTrigger（防止锚点多次跳转堆积实例）
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === card) st.kill()
      })
      delete card.dataset.bound // 允许重播
    })
    const total = cards.length
    const center = (total - 1) / 2
    cards.forEach((card, i) => {
      const dist = i - center
      const delay = Math.abs(dist) * 0.12
      const fromX = Math.abs(dist) < 0.001 ? 0 : (dist < 0 ? 1 : -1) * (60 + Math.floor(Math.abs(dist) + 0.5) * 20)
      revealCard(card, delay, fromX)
    })
  })
}

/* ── 解析启动落点（统一启动序列第 2 步用）──
   - 无 hash / #top → 顶部（Hero，top:true）
   - #tianxuan-solo / #wujian-shengjing 等 TabGroup hash → 落在其版块元素
     （#xxx-yyy 去掉最后一段找 #xxx），y = 元素文档位置 − 80（与锚点点击一致）
   - 找不到元素 → 回退顶部 */
function resolveHashTarget() {
  const raw = (window.location.hash || '').slice(1)
  if (!raw || raw === 'top') return { el: null, raw }
  for (const cand of [raw, raw.replace(/-[^-]+$/, '')]) {
    const el = document.getElementById(cand)
    if (el) return { el, raw, id: cand }
  }
  return { el: null, raw }
}

/** 落点 y = 目标元素文档位置 − 80（与锚点点击的预留一致，实时测量，禁缓存） */
function landingY(el) {
  return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - 80))
}

export function computeLanding() {
  const { el, raw, id } = resolveHashTarget()
  if (!el) return { top: true, y: 0, hash: raw || '' }
  return { top: false, y: landingY(el), hash: raw, target: id }
}

export function initAnchors() {
  const links = document.querySelectorAll('a[href^="#"]')
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href')
      if (!href || href === '#') return
      const target = document.querySelector(href)
      if (!target) return

      // reduced-motion：直接原生跳转
      if (isReduce()) return // 不 preventDefault，交给浏览器

      e.preventDefault()
      const lenis = window.__lenis
      if (lenis) {
        lenis.scrollTo(target, {
          duration: 1.4,
          easing: easeInOutCubic,
          offset: -80, // 顶部预留 80px 呼吸空间
          onComplete: () => {
            replaySectionReveals(target)
            // 保持 URL 锚点同步（replace 不产生历史）
            history.replaceState(null, '', href)
            ScrollTrigger.refresh()
          },
        })
      } else {
        // Lenis 不可用（如 reduced-motion 已停 scrollTo）：直接跳
        window.location.hash = href
      }
    })
  })

  // （首次启动落点由 App 统一启动序列负责：Lenis → 立即定位 → 才创建入场 ST）

  /* 同文档 hash 变化（在地址栏改 hash、外链片段导航 —— 页面不重新加载，
     启动序列不会重跑）：#tianxuan-solo 这类 hash 没有对应元素，浏览器原生跳转会落空，
     这里补一次与启动序列一致的"无动画落点"。
     注意：TabGroup 切 Tab 用 replaceState，不触发 hashchange，不会互相打架。 */
  const onHashChange = () => {
    const { el } = resolveHashTarget()
    if (!el) return
    const y = landingY(el)
    const lenis = window.__lenis
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
    ScrollTrigger.refresh()
  }
  window.addEventListener('hashchange', onHashChange)
}

/* ──────────────────────────────────────────────────────────
 * 二、Tab 面板切换过渡
 *   旧面板：opacity 1→0 + translateY(-8px) 0.25s ease-in（GSAP，完成后才换 state）
 *   新面板：tabchange 事件后由 fx 做元素错峰（80ms）
 *   指示器：注入 .tab-indicator 滑块，transition 跟随 active 位置
 * ────────────────────────────────────────────────────────── */

/** 注入滑动指示器（每个 .tab-bar），监听 tabchange 更新位置 */
export function initTabIndicator() {
  document.querySelectorAll('.tab-bar').forEach((bar) => {
    if (bar.querySelector('.tab-indicator')) return
    const ind = document.createElement('span')
    ind.className = 'tab-indicator'
    bar.appendChild(ind)
  })
  const place = () => {
    document.querySelectorAll('.tab-bar').forEach((bar) => {
      const ind = bar.querySelector('.tab-indicator')
      const active = bar.querySelector('.tab-btn.is-active')
      if (!ind || !active) return
      const barRect = bar.getBoundingClientRect()
      const actRect = active.getBoundingClientRect()
      // transform 化：左偏移走 translateX，宽度走 scaleX(目标宽 / 基准宽)。
      // 基准宽由 CSS 给（.tab-indicator 的 width，约 100px）；offsetWidth 不受 transform 影响，
      // 读到的正好是那个基准值。CSS 端只过渡 transform / opacity，不再过渡 left / width
      // —— impeccable [layout-transition] 告警点。
      const base = ind.offsetWidth || 1
      ind.style.transform = `translateX(${actRect.left - barRect.left}px) scaleX(${actRect.width / base})`
      ind.style.opacity = '1'
    })
  }
  // 初次 + tabchange 时定位（tab 切换会换 is-active class）
  place()
  document.addEventListener('tabchange', () => requestAnimationFrame(place))
  // 窗口尺寸变化时重新定位
  window.addEventListener('resize', () => requestAnimationFrame(place))
}

/* ──────────────────────────────────────────────────────────
 * 三、移动端触屏反馈（替代 hover；仅 hover:none 启用）
 *   1. :active 按压 scale(.98) + 稀有度描边增亮（纯 CSS 处理）
 *   2. 首次 tap 轻量反馈：光晕脉冲一次 + 进度条短暂填充
 * ────────────────────────────────────────────────────────── */
export function initTouchFeedback() {
  if (!isTouch() || isReduce()) return
  const cards = document.querySelectorAll('.hero-card, .weapon-card, .build-card, .treasure-item')
  cards.forEach((card) => {
    let touched = false
    let timer = null
    let fillTimer = null
    card.addEventListener('touchstart', () => {
      if (touched) return // 连续 tap 不重复完整效果
      touched = true
      timer = setTimeout(() => { touched = false }, 1200)

      // 光晕脉冲一次：复用 tilt-glow（若无则临时创建）
      let glow = card.querySelector('.tilt-glow')
      if (!glow) {
        glow = document.createElement('span')
        glow.className = 'tilt-glow'
        card.appendChild(glow)
      }
      gsap.fromTo(glow,
        { opacity: 0.9 },
        { opacity: 0, duration: 0.6, ease: 'power2.out', clearProps: 'opacity' }
      )

      // 进度条短暂填充展示：加 .is-tap-fill 类（CSS 控制填充 → 0.9s 后移除回落）
      const fills = card.querySelectorAll('.usage-bar-fill')
      if (fills.length && !card.classList.contains('is-tap-fill')) {
        card.classList.add('is-tap-fill')
        clearTimeout(fillTimer)
        fillTimer = setTimeout(() => card.classList.remove('is-tap-fill'), 900)
      }
    })
  })
}

/* ──────────────────────────────────────────────────────────
 * 四、首屏加载时序保护
 *   document.fonts.ready + Hero 资源就绪（3s 兜底）→ 隐藏 loading 线
 *   → 100ms 后派发 hero-ready 事件，由 fx.js 启动 Hero 墨迹时间轴
 * ────────────────────────────────────────────────────────── */
export function initHeroWait() {
  const hero = document.querySelector('#top')
  if (!hero || isReduce()) {
    window.dispatchEvent(new CustomEvent('hero-ready'))
    return
  }

  // 添加极简 loading 状态：标题区留白 + 一道细剑气往返（纯 CSS）
  if (!document.querySelector('.hero-loading')) {
    const ld = document.createElement('div')
    ld.className = 'hero-loading'
    ld.setAttribute('aria-hidden', 'true')
    hero.appendChild(ld)
  }

  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    // loading 线淡出 0.3s 后视为就绪
    const ld = document.querySelector('.hero-loading')
    if (ld) gsap.to(ld, { opacity: 0, duration: 0.3, onComplete: () => ld.remove() })
    // 就绪后延后 100ms 再播首屏时间轴
    setTimeout(() => window.dispatchEvent(new CustomEvent('hero-ready')), 100)
  }

  // 等字体 + poster 首帧图就绪（视频不阻塞首屏：验收 9 "视频请求不阻塞首屏渲染"，
  // 视频就绪由 fx.initHeroVideo 独立管理，canplay 后交叉淡入）
  const fontReady = document.fonts ? document.fonts.ready : Promise.resolve()
  const posterReady = new Promise((res) => {
    const imgs = Array.from(hero.querySelectorAll('.hero-poster'))
    // 无海报图（理论上都有）时视为就绪
    if (!imgs.length) return res()
    let pending = imgs.length
    const check = () => { if (--pending <= 0) res() }
    imgs.forEach((img) => {
      if (img.complete) check()
      else { img.addEventListener('load', check); img.addEventListener('error', check) }
    })
  })

  // 加载屏揭示的那一刻起跑：Hero 入场时间轴与墨晕退场重叠，衔接无缝。
  // 无加载屏 / reduced-motion（已跳过加载屏）时 __preloader.revealed() 立即为 true。
  const revealGate = new Promise((res) => {
    const pre = window.__preloader
    if (!pre || pre.revealed()) return res()
    window.addEventListener('preloader-reveal', res, { once: true })
  })

  Promise.all([fontReady, posterReady, revealGate]).then(finish)
  // 兜底：加载屏最长 5s + 退场 0.9s；资源或加载屏异常时也放行
  setTimeout(finish, 6000)
}

/* ──────────────────────────────────────────────────────────
 * 统一入口（App 调用）：四处接缝全部初始化
 * ────────────────────────────────────────────────────────── */
export default function initJoins() {
  initAnchors()
  initTabIndicator()
  initTouchFeedback()
  initHeroWait()
}