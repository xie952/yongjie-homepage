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
 * 四、卡片列表入场：由中心向两侧展开（fan-out）
 *   —— 组件/指令级通用编排，数据驱动，不针对任何 section 硬编码
 *
 * 接入方式：在【卡片容器】上挂 data-reveal-group="fan"，其【直接子元素】即卡片。
 *   条数变化自动适配（奇数/偶数/0/1/2 张都有定义），卡片增减不需要改任何代码。
 *   本节的编排算法是唯一实现，三个触发时机共用同一份：
 *     ① 首屏         initScrollReveals()          （本文件）
 *     ② 锚点跳转重播  reinitSection()              （join.js）
 *     ③ 切 Tab 新面板 replayGroupCards()           （fx.js）
 *   此前这段算法在三个文件里各复制了一份，改一处漏两处。
 *
 * 几何（以列表几何中心为基准）
 *   · 奇数张 → 中间一张 = 基准组（level 0），向两侧按层级递增
 *   · 偶数张 → 中间两张同属基准组（同为 level 0），向两侧按层级递增
 *   节奏：基准组 0ms，每向外一层 +60ms，封顶 300ms
 *   位移：横向排布 → 左半区自左侧(−40px)归位、右半区自右侧(+40px)归位，叠加自下方 40px 上浮
 *         纵向堆叠（窄屏塌成单列）→ 自动降级为「上侧自上、下侧自下」的纵向展开，横向位移归零
 *   收尾：clearProps:'transform' —— 入场结束立刻把 transform 交还 CSS 的分层与 hover tilt
 *
 * 向后兼容：容器不写 ="fan" 时走下面的 legacy 分支，位移方向/幅度/节奏与改动前逐字一致
 *   → 未接入的组（stat-grid / profile-socials / closing-head / mode-rank-row …）零波及。
 * ────────────────────────────────────────────────────────── */
export const FAN = {
  step: 0.06,     // 相邻层级错峰 60ms
  maxDelay: 0.3,  // 错峰封顶 300ms
  dist: 40,       // 轴向位移幅度（横：左 −40 / 右 +40；纵：上 −40 / 下 +40）
  riseY: 40,      // 横向排布时统一的「自下方上浮」位移
  duration: 0.55, // 单卡时长；4 张卡含错峰总时长 ≈ 0.61s
  scale: 0.95,    // 起始缩放
  ease: [0.22, 1, 0.36, 1], // 与站内既有入场同一条曲线
}

/** 单卡入场。fromY/duration/scale 走 options，保持既有三参数调用点不变 */
export function revealCard(el, delay = 0, fromX = 0, { fromY = 40, duration = 0.9, scale = 0.96 } = {}) {
  if (!el || el.dataset.bound) return
  el.dataset.bound = '1'
  if (reducedMotion()) { gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform' }); return }

  gsap.fromTo(
    el,
    { opacity: 0, x: fromX, y: fromY, scale },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration,
      ease: FAN.ease, // cubic-bezier(0.22,1,0.36,1)
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

/** 距中心的层级：奇数张中心卡 = 0；偶数张中间两张同为 0（共为基准组） */
export function fanLevel(i, total) {
  return Math.max(0, Math.ceil(Math.abs(i - (total - 1) / 2) - 0.5))
}

/** 单卡编排 → { delay, x, y }。stacked=true 表示容器已纵向堆叠 */
export function fanSlot(i, total, stacked = false) {
  const dist = i - (total - 1) / 2
  const level = fanLevel(i, total)
  const delay = Math.min(level * FAN.step, FAN.maxDelay)
  if (level === 0) return { delay, x: 0, y: FAN.riseY }               // 基准组：只淡入 + 上浮
  if (stacked) return { delay, x: 0, y: dist < 0 ? -FAN.dist : FAN.dist }
  return { delay, x: dist < 0 ? -FAN.dist : FAN.dist, y: FAN.riseY }
}

/** 容器是否已纵向堆叠：看第 2 个直接子元素是否换行到下一排（用几何判定，不依赖任何断点常量） */
export function isStackedGroup(group) {
  const kids = Array.from(group.children)
  if (kids.length < 2) return false
  const a = kids[0].getBoundingClientRect()
  const b = kids[1].getBoundingClientRect()
  return b.top - a.top > a.height * 0.5
}

/** 组的直接子卡片（跳过嵌套组，交给内层自己管理，避免双重动画） */
export function groupCards(group) {
  return Array.from(group.children).filter(
    (c) => c.dataset.reveal !== 'none' && !c.hasAttribute('data-reveal-group')
  )
}

/**
 * 统一入口：给一个卡片容器做整组入场编排。
 * fan 模式以【容器】为触发单位（整组同起同落）——逐卡触发会被视口边缘把错峰切碎，
 * 纵向堆叠时更明显（下面几张还没进视口就开始计时）。
 * @param group  卡片容器
 * @param replay true = 重播（锚点跳转）：先杀掉旧的 ScrollTrigger / timeline 并解除绑定
 * @returns 参与编排的卡片数
 */
export function revealCardGroup(group, { replay = false } = {}) {
  if (!group) return 0
  const cards = groupCards(group)
  if (!cards.length) return 0
  const total = cards.length

  if (replay) {
    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === group || cards.indexOf(st.trigger) !== -1) st.kill()
    })
    if (group._fanTl) { group._fanTl.kill(); group._fanTl = null }
    cards.forEach((card) => { delete card.dataset.bound })
    delete group.dataset.fanBound
  }

  // —— 向后兼容：未标 ="fan" 的组走 legacy（与改动前逐字一致） ——
  if (group.dataset.revealGroup !== 'fan') {
    const center = (total - 1) / 2
    cards.forEach((card, i) => {
      const dist = i - center
      const delay = Math.abs(dist) * 0.12
      const fromX = Math.abs(dist) < 0.001 ? 0 : (dist < 0 ? 1 : -1) * (60 + Math.floor(Math.abs(dist) + 0.5) * 20)
      revealCard(card, delay, fromX)
    })
    return total
  }

  // —— fan 模式：整组一次编排 ——
  if (group.dataset.fanBound) return total // 单例：重复扫描不叠加
  group.dataset.fanBound = '1'
  cards.forEach((card) => { card.dataset.bound = '1' }) // 与旧入口互斥，防双绑

  if (reducedMotion()) {
    cards.forEach((card) => gsap.set(card, { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'transform' }))
    return total
  }

  const stacked = isStackedGroup(group)
  const tl = gsap.timeline({ paused: true })
  cards.forEach((card, i) => {
    const { delay, x, y } = fanSlot(i, total, stacked)
    tl.fromTo(
      card,
      { opacity: 0, x, y, scale: FAN.scale },
      { opacity: 1, x: 0, y: 0, scale: 1, duration: FAN.duration, ease: FAN.ease, clearProps: 'transform' },
      delay // 位置参数 = 时间轴上的绝对时刻，即错峰
    )
  })
  group._fanTl = tl

  ScrollTrigger.create({
    trigger: group,      // 以容器为单位触发（不是逐卡）
    start: 'top 80%',
    once: true,          // 进过就不再重播：来回滚动不闪
    onEnter: () => tl.play(),
  })
  return total
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
 *   data-reveal-group                    → 卡片组容器（其直接子元素为卡片，legacy 编排）
 *   data-reveal-group="fan"              → 同上，但走「由中心向两侧」新编排（见第四节 FAN）
 *   data-split                           → 文字拆字（标题）
 * ────────────────────────────────────────────────────────── */
export function initScrollReveals() {
  // 1. data-split 标题：逐字遮罩升起
  document.querySelectorAll('[data-split]').forEach((el) => revealText(el))

  // 2. 卡片组容器：统一交给 revealCardGroup 编排（每组独立计算中心，不跨组）
  //    该函数同时承担 legacy / fan 两套行为的分发，是本项目唯一的卡片组入口
  document.querySelectorAll('[data-reveal-group]').forEach((group) => revealCardGroup(group))

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
