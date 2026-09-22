import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

/* ════════════════════════════════════════════════════════════
 * 动效系统（GSAP + ScrollTrigger + Lenis）
 * ------------------------------------------------------------
 * 设计约束（严格遵循）：
 * - 只动画 transform / opacity，绝不动 top/left/width/height
 * - 不改任何颜色/字体/圆角/间距等视觉样式
 * - prefers-reduced-motion 时全部禁用，直接显示最终态
 * 用法：App 挂载后调用 initSiteMotion() 即可
 * ════════════════════════════════════════════════════════════ */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)' // 主缓动：先快后缓
const EASE_BOUNCE = 'elastic.out(1, 0.5)'      // 按钮回弹

/* 统一缓动：GSAP 需要字符串或贝塞尔数组 */
function easeOut() { return gsap.parseEase('power3.out') }

/** 系统是否开启"减少动态" */
function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ──────────────────────────────────────────────────────────
 * 一、全局平滑滚动（Lenis + ScrollTrigger 同步）
 * ────────────────────────────────────────────────────────── */
export function initSmoothScroll() {
  if (reducedMotion()) return null

  const lenis = new Lenis({
    lerp: 0.115,        // 修复七：0.1→0.115 更跟手（<0.2 保顺滑重量感），duration 不动
    duration: 1.2,      // 滚动时长
    smoothWheel: true,
    autoResize: false,  // 刷新首帧避免 ResizeObserver 反复测量全页高度；由 App 明确 resize()
    // 与 GSAP ScrollTrigger 双向联动
    // (参考官方集成方式)
  })

  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)

  // 暴露全局引用：fx.js 的锚点平滑跳转 / 其他模块需要 lenis.scrollTo
  window.__lenis = lenis

  return lenis
}

/* ──────────────────────────────────────────────────────────
 * 二、文字逐字/逐词遮罩升起（标题类）
 *   中文按字、英文按词拆成 span；父容器 overflow hidden
 * ────────────────────────────────────────────────────────── */
export function revealText(el, { delay = 0 } = {}) {
  if (!el || reducedMotion()) { if (el) gsap.set(el, { opacity: 1 }); return }
  if (el.dataset.splitDone) return // 防止重复拆分
  el.dataset.splitDone = '1'

  // 只拆纯文本，保留内部已有标签结构
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  const textNodes = []
  while (walker.nextNode()) {
    const t = walker.currentNode
    if (t.textContent.trim()) textNodes.push(t)
  }
  if (!textNodes.length) return

  const charSpans = []
  textNodes.forEach((node) => {
    const text = node.textContent
    const frag = document.createDocumentFragment()
    // 中文逐字、英文/数字逐词
    const tokens = text.match(/[\u4e00-\u9fff]|[\u4e00-\u9fff].|[\w]+|[\s]+|[^\s\w\u4e00-\u9fff]/g) || []
    // 更稳的拆分：单字符级（含标点/空格保留为不可见占位）
    const units = Array.from(text)
    const container = document.createElement('span')
    container.style.display = 'inline-block'
    container.style.overflow = 'hidden'
    container.style.verticalAlign = 'top'
    units.forEach((ch, i) => {
      const s = document.createElement('span')
      s.className = 'gsap-char'
      s.textContent = ch
      s.style.display = 'inline-block'
      s.style.willChange = 'transform, opacity'
      if (/\s/.test(ch)) {
        // 空格：不隐藏（保持词间距），直接放行
        s.style.opacity = '1'
        s.style.transform = 'none'
      } else {
        container.appendChild(s)
        charSpans.push(s)
      }
      frag.appendChild(s)
    })
    node.parentNode.replaceChild(frag, node)
    void container // 占位保 display 上下文
  })

  // 初始态：全部压到容器下沿
  gsap.set(charSpans, { yPercent: 110, opacity: 0 })

  // 进入视口后逐字升起
  gsap.to(charSpans, {
    yPercent: 0,
    opacity: 1,
    duration: 0.9,
    ease: easeOut(),
    stagger: 0.08, // 字符错峰 80ms
    // 性能：入场完成后回收 inline will-change（还原 auto，仅合成层提示）
    onComplete: () => charSpans.forEach((s) => { if (s) s.style.willChange = 'auto' }),
    delay,
    scrollTrigger: {
      trigger: el,
      start: 'top 82%',
      once: true, // 只播一次
    },
  })
}

/* ──────────────────────────────────────────────────────────
 * 三、通用元素入场（正文/段落：整块淡入上浮）
 * ────────────────────────────────────────────────────────── */
export function revealUp(el, { delay = 0 } = {}) {
  if (!el || el.dataset.bound) return
  el.dataset.bound = '1'
  if (reducedMotion()) { gsap.set(el, { opacity: 1, y: 0 }); return }

  gsap.fromTo(
    el,
    { opacity: 0, y: 24 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: easeOut(),
      delay,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    }
  )
}

/* ──────────────────────────────────────────────────────────
 * 四、卡片入场：从中心向两侧展开（fan-out）
 *   - 中心卡 delay=0 纯上浮；左侧卡从右滑入(+X)；右侧卡从左滑入(−X)
 *   - delay = |i - centerIndex| × 0.12s
 *   - fromX = 方向 × (60px + 距中心层级 × 20px)
 * ────────────────────────────────────────────────────────── */
export function revealCard(el, delay = 0, fromX = 0) {
  if (!el || el.dataset.bound) return
  el.dataset.bound = '1'
  if (reducedMotion()) { gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform' }); return }

  gsap.fromTo(
    el,
    { opacity: 0, x: fromX, y: 40, scale: 0.96 },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1], // cubic-bezier(0.22,1,0.36,1)
      delay,
      clearProps: 'transform', // 入场结束清 inline transform，交给 CSS 的 translateZ 分层 / hover tilt
      scrollTrigger: {
        trigger: el,
        start: 'top 80%', // 进入视口 20% 时播放
        once: true,
      },
    }
  )
}

/** 中心扩散延迟算法：delay = |i - (n-1)/2| × 0.12s */
function fanDelay(i, total) {
  const center = (total - 1) / 2
  return Math.abs(i - center) * 0.12
}

/** 中心扩散横向位移：direction × (60 + level × 20) */
function fanFromX(i, total) {
  const center = (total - 1) / 2
  const dist = i - center
  if (Math.abs(dist) < 0.001) return 0        // 正中心：纯上浮
  const direction = dist < 0 ? 1 : -1          // 左侧(+X 从右滑入) / 右侧(−X 从左滑入)
  const level = Math.floor(Math.abs(dist) + 0.5) // 距中心层级（偶数卡中间两卡为 0 级）
  return direction * (60 + level * 20)
}

/* ──────────────────────────────────────────────────────────
 * 五、鼠标悬停交互（按钮/卡片/导航）
 * ────────────────────────────────────────────────────────── */
export function initHover() {
  if (reducedMotion()) return

  // 按钮：hover 放大 1.03、按下 0.97，带回弹
  document.querySelectorAll('.btn').forEach((btn) => {
    gsap.set(btn, { transformOrigin: 'center' })
    btn.addEventListener('mouseenter', () => gsap.to(btn, { scale: 1.03, duration: 0.35, ease: 'back.out(1.7)' }))
    btn.addEventListener('mouseleave', () => gsap.to(btn, { scale: 1, duration: 0.35, ease: 'back.out(1.7)' }))
    btn.addEventListener('mousedown', () => gsap.to(btn, { scale: 0.97, duration: 0.2, ease: 'power2.out' }))
    btn.addEventListener('mouseup', () => gsap.to(btn, { scale: 1.03, duration: 0.35, ease: 'back.out(1.7)' }))
  })

  // 卡片：hover 上浮 6px，内部图片放大 1.04
  // （.hero-card/.weapon-card/.build-card 由 fx.js 的 3D tilt 接管位移，此处只做内部图形放大）
  const TILTED = '.hero-card, .weapon-card, .build-card'
  document.querySelectorAll('.stat-card, .hero-card, .weapon-card, .build-card, .treasure-item').forEach((card) => {
    gsap.set(card, { transformOrigin: 'center' })
    const isTilted = card.matches(TILTED)
    card.addEventListener('mouseenter', () => {
      if (!isTilted) gsap.to(card, { y: -6, duration: 0.4, ease: 'power2.out' })
      const img = card.querySelector('img, .skin-swatch, .hero-card-avatar, .weapon-card-icon')
      if (img) gsap.to(img, { scale: 1.04, duration: 0.4, ease: 'power2.out' })
    })
    card.addEventListener('mouseleave', () => {
      if (!isTilted) gsap.to(card, { y: 0, duration: 0.4, ease: 'power2.out' })
      const img = card.querySelector('img, .skin-swatch, .hero-card-avatar, .weapon-card-icon')
      if (img) gsap.to(img, { scale: 1, duration: 0.4, ease: 'power2.out' })
    })
  })
}

/* 注：旧的首屏加载时间轴 initLoadTimeline() 已删除——它是死代码（无调用方），
   且引用了已移除的顶部导航栏 .navbar。首屏时序统一由 fx.js 的 playHeroMotion 负责。 */

/* ──────────────────────────────────────────────────────────
 * 七、统一入口：扫描页面上带 data- 标记的元素并批量绑定
 *   data-reveal="card|text|up"          → 单个元素入场类型
 *   data-reveal-group                    → 卡片组容器（其直接子元素为卡片）
 *   data-split                           → 文字拆字（标题）
 * ────────────────────────────────────────────────────────── */
export function initScrollReveals() {
  // 1. data-split 标题：逐字遮罩升起
  document.querySelectorAll('[data-split]').forEach((el) => revealText(el))

  // 2. 卡片组容器：子元素"从中心向两侧展开"
  //    每组独立计算 centerIndex，不跨组
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    // 收集直接子卡片：跳过本身也是 group 的嵌套容器（由内层自己管理，避免双重动画）
    const cards = Array.from(group.children).filter(
      (c) => c.dataset.reveal !== 'none' && !c.hasAttribute('data-reveal-group')
    )
    if (!cards.length) return
    const total = cards.length
    cards.forEach((card, i) => {
      const delay = fanDelay(i, total)   // |i - (n-1)/2| × 0.12s
      const fromX = fanFromX(i, total)   // 方向 × (60 + 层级×20)，中心为 0
      revealCard(card, delay, fromX)
    })
  })

  // 3. 独立元素入场（单个 data-reveal="card"，无组，默认纯上浮）
  document.querySelectorAll('[data-reveal="card"]').forEach((el) => revealCard(el, 0, 0))
  document.querySelectorAll('[data-reveal="up"]').forEach((el) => revealUp(el))

  // 4. 刷新由 App 启动序列统一执行，避免首帧重复全页测量
}

/* ──────────────────────────────────────────────────────────
 * 主入口：App 挂载后调用一次
 * ────────────────────────────────────────────────────────── */
export default function initSiteMotion({ createLenis = true, setupInteractions = true } = {}) {
  const lenis = createLenis ? initSmoothScroll() : null
  if (!setupInteractions) return lenis
  initHover()
  // 注意：Hero 入场（导航/标题墨迹显形/slogan/按钮时间轴）已移交 fx.js 的 initHeroMotion，
  // 这里不再调用 initLoadTimeline，避免双时间轴冲突。
  // 等首屏 DOM 完全就绪后绑定滚动类动画
  requestAnimationFrame(() => initScrollReveals())

  // 移动端：关闭 hover（触摸无 hover 概念）
  if (window.matchMedia('(hover: none)').matches) return lenis

  return lenis
}
