import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { revealCard } from './animations'
import initFluidHero from './fluid'
import { effects } from '../data/stats'

gsap.registerPlugin(ScrollTrigger)
// 诊断/回归用：暴露全局，便于验收脚本读取每个 ST 的 trigger 与 start/end 计算值
if (typeof window !== 'undefined') window.ScrollTrigger = ScrollTrigger

/* ──────────────────────────────────────────────────────────
 * 单一循环（性能）：Hero 的所有"每帧工作"（视差阻尼 / 水波绘制）统一挂
 * gsap.ticker，不再各自开 rAF。任务函数返回 true 表示"还有活要干"，
 * 全部返回 false 时自动摘掉回调 → 空闲零空转（Hero 被覆盖/视频暂停时自然停转）。
 * ────────────────────────────────────────────────────────── */
const heroLoop = (() => {
  const tasks = new Set()
  let added = false
  const frame = () => {
    let busy = false
    tasks.forEach((fn) => { if (fn() === true) busy = true })
    if (!busy && added) { gsap.ticker.remove(frame); added = false }
  }
  return {
    add(fn) { tasks.add(fn) },
    remove(fn) {
      tasks.delete(fn)
      if (!tasks.size && added) { gsap.ticker.remove(frame); added = false }
    },
    wake() { if (!added) { added = true; gsap.ticker.add(frame) } },
  }
})()

/* 首屏是否已被下一区块完全覆盖（视频/WebGL 据此停转） */
let heroCovered = false
/* 注：此处原有 heroIntroActive / releaseHeroVideo —— 即"文字时间轴没播完就冻结视频与 WebGL"
   的性能守卫。它导致刷新后入场期间背景是静止画面（poster/首帧），文字动效结束后视频才播放。
   现【已删除】：文字轨道与视频轨道彻底并行，谁就绪谁先动（详见 initHeroVideo / initFx）。 */

/* ════════════════════════════════════════════════════════════
 * 动效升级 v2（fx.js）
 * ------------------------------------------------------------
 * 函数清单：
 *   initHeroMotion()   Hero 墨迹显形时间轴 + 剑光扫过
 *   initHeroParallax() 三层同向鼠标视差（单一循环阻尼：视频±8/立绘±20/文字±4）
 *   initHeroVideo()    Hero 视频播放管理（poster 淡入/视口暂停恢复/被覆盖暂停）
 *   initHeroCover()    叠层转场驱动（覆盖进度：内容淡出 + 视频/画布同步 scale + 覆盖后停转）
 *   initCoverLayout()  sticky 布局开关（首屏高度 ≤ 视口才启用）
 *   initStickyHygiene() 叠层区块 will-change 卫生（前后 100vh 挂、静止 2s 摘）
 *   initFluidHero()    WebGL 水波（fluid.js：rVFC 纹理节流 + 涟漪衰减 + 降级链）
 *   countUp()          数字滚动计数器（静态数字用）
 *   initTilt()         卡片 3D 倾斜（桌面端）
 *   initRarityGlow()   稀有度流光边框
 *   initJadeLight()    魂玉词条依次点亮
 *   initGrain()        全局噪点纹理
 *   initProgressBar()  顶部滚动进度条
 *   initFx()           统一入口
 * 约束：只动画 transform/opacity/filter；reduced-motion 全部降级
 * ════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1]
const isReduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isDesktop = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches && !isReduce()

/* 改前终态实测矩阵：旧 GSAP 动画结束后 SVG 字形实际使用的静态位置。
   新时间轴先 clearProps 清动画属性，再写回这组矩阵，保证终态逐像素不漂移。 */
const HERO_CHAR_SETTLED_MATRICES = [
  'matrix(0.99961,-0.02792,0.02792,0.99961,-3.60294,3.19793)',
  'matrix(0.99978,0.02094,-0.02094,0.99978,2.85317,-6.40676)',
  'matrix(0.9999,-0.01396,0.01396,0.9999,-1.7836,6.95688)',
  'matrix(0.99951,0.03141,-0.03141,0.99951,4.53266,-21.66763)',
]

/* 注：原 splitIntoChars() 已删除 —— 大标题改为图片样式（内联 SVG 图像），
   逐字显形改为直接驱动 SVG 里的 .hero-char 节点，无需再拆文本节点。 */

/* ──────────────────────────────────────────────────────────
 * 一、Hero：时间轴只编排"何时出场"，不改变任何排版
 *   主标题 0.15s → 印章 1.60s → 副标题 1.95s → 诗句 2.40s → 按钮 3.30s
 *   由 join.js 的 hero-ready 事件触发（字体/资源就绪后）
 * ────────────────────────────────────────────────────────── */
export function playHeroMotion(onComplete) {
  if (isReduce()) return null
  const hero = document.querySelector('#top')
  if (!hero) return null

  const subtitle = document.getElementById('hero-ink-subtitle')
  const titleWrap = document.getElementById('hero-ink-title-wrap')
  const title = document.getElementById('hero-ink-title')
  const titleArt = title?.querySelector('.hero-title-art')          // 内置水墨矢量标题
  const titleImage = title?.querySelector('.hero-title-image')      // 自定义图片标题（player.titleLogo）
  const heroChars = titleArt ? Array.from(titleArt.querySelectorAll('.hero-char')) : []
  const seal = document.getElementById('hero-ink-seal')             // SVG 内的朱红印章（落款）
  const slogan = document.getElementById('hero-ink-slogan')
  const sloganChars = slogan ? Array.from(slogan.querySelectorAll('.hero-slogan-char')) : []
  const actions = document.getElementById('hero-ink-actions')
  const detailButton = actions?.querySelector('.hero-detail-btn')
  // 注意：动画必须挂在内层面板 .dock-panel 上——外层 .dock 靠 CSS translateX(-50%) 居中，
  // GSAP 写 y 会整体覆盖该 transform，导致 Dock 水平偏移（移动端会把末尾项挤出视口）
  const dockPanel = document.querySelector('.dock-panel')

  const tl = gsap.timeline({ defaults: { ease: EASE } })

  // 顶部 Dock 保留既有入场，不占用 Hero 文案的出场时刻
  if (dockPanel) { gsap.set(dockPanel, { y: -20, opacity: 0 }); tl.to(dockPanel, { y: 0, opacity: 1, duration: 0.8 }, 0) }

  // 0.15s：主标题四字"墨晕凝固"（0.9s/字，字间 180ms）
  if (heroChars.length) {
    gsap.set(titleArt, { opacity: 1 })
    gsap.set(heroChars, {
      opacity: 0,
      scale: 1.18,
      filter: 'blur(12px)',
      transformOrigin: '50% 50%',
    })
    tl.to(heroChars, {
      opacity: 1, scale: 1, filter: 'blur(0px)',
      duration: .9, stagger: .18, ease: EASE,
    }, .15)
  } else if (titleImage || title) {
    // 自定义图片标题（或极端降级）：整幅 blur+scale 淡入
    const el = titleImage || title
    gsap.set(el, { opacity: 0, scale: 1.18, filter: 'blur(12px)' })
    tl.to(el, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: .9, ease: EASE }, .15)
  }

  // 1.60s：盖章（0.35s）→ 标题 3px 落印微震（规格保持现状）
  // 旋转/缩放中心由 SVG 结构保证：#hero-ink-seal 的局部原点就是印章中心
  // （外层 <g> 已 translate 到印章中心）—— 无需 svgOrigin / transform-origin 干预
  if (seal) {
    gsap.set(seal, { opacity: 0, scale: 1.7, rotate: 8 })
    tl.to(seal, {
      opacity: .92, scale: 1, rotate: 3,
      duration: .35, ease: 'power3.out',
    }, 1.60)
  }
  if (titleWrap) {
    tl.to(titleWrap, { y: 3, duration: .075, ease: 'power2.in' }, 1.95)
    tl.to(titleWrap, { y: 0, duration: .075, ease: 'back.out(2)' }, 2.025)
  }

  // 1.95s：副标题"墨点聚拢"（0.8s，letter-spacing 精确回到当前 CSS 值）
  if (subtitle) {
    const finalSpacing = getComputedStyle(subtitle).letterSpacing
    gsap.set(subtitle, { opacity: 0, letterSpacing: '.9em', textIndent: '.45em' })
    tl.to(subtitle, {
      opacity: 1, letterSpacing: finalSpacing, textIndent: '0px',
      duration: .8, ease: EASE,
    }, 1.95)
  }

  // 2.40s：诗句 11 个字符逐个"浮墨"（0.5s/字，字间 70ms；容器本身不动）
  if (sloganChars.length) {
    gsap.set(sloganChars, { display: 'inline-block', opacity: 0, y: 14, filter: 'blur(4px)' })
    tl.to(sloganChars, {
      opacity: 1, y: 0, filter: 'blur(0px)',
      duration: .5, stagger: .07, ease: EASE,
    }, 2.40)
  }

  // 3.30s：按钮容器墨晕入场（0.5s）+ 单次白描边波纹（0.8s）
  if (actions) {
    gsap.set(actions, { opacity: 0, scale: .92, transformOrigin: '50% 50%' })
    tl.to(actions, { opacity: 1, scale: 1, duration: .5, ease: EASE }, 3.30)
  }
  if (detailButton) {
    tl.fromTo(detailButton,
      { '--hero-ripple-scale': .85, '--hero-ripple-opacity': .7 },
      { '--hero-ripple-scale': 1.45, '--hero-ripple-opacity': 0, duration: .8, ease: 'power2.out', immediateRender: false },
      3.30
    )
  }

  // 首帧前移除 pending；所有目标已由 gsap.set 置为隐藏，仍不会闪出原始态。
  hero.classList.remove('hero-anims-pending')

  // 性能：整条墨迹时间轴播完 → 给 Hero 打 hero-anims-done 标记，
  // 并清掉拆字 span 的【内联】will-change（内联优先于样式表，仅 CSS 规则回收无效；
  // 还原后常驻合成层释放。纯提示无视觉影响；重播时 GSAP 重新走 blur，观感一致）
  tl.eventCallback('onComplete', () => {
    if (!hero) return
    hero.classList.add('hero-anims-done')
    hero.querySelectorAll('.ink-char, .gsap-char, .hero-char, .hero-slogan-char').forEach((s) => { s.style.willChange = 'auto' })
    if (heroChars.length) {
      gsap.set(heroChars, { clearProps: 'transform,filter,transformOrigin' })
      heroChars.forEach((el, i) => {
        el.setAttribute('transform', HERO_CHAR_SETTLED_MATRICES[i])
        // 清掉动画属性后补回改前的静态 SVG 基线，避免字形抗锯齿与 0 位移状态漂移。
        el.style.translate = 'none'
        el.style.rotate = 'none'
        el.style.scale = 'none'
        el.style.transformOrigin = '0px 0px'
        el.style.filter = 'blur(0px)'
      })
    }
    if (sloganChars.length) gsap.set(sloganChars, { clearProps: 'display,transform,filter' })
    if (subtitle) gsap.set(subtitle, { clearProps: 'letterSpacing,textIndent,transform,filter' })
    if (actions) {
      gsap.set(actions, { clearProps: 'transform' })
      actions.style.removeProperty('transform-origin')
    }
    if (titleWrap) gsap.set(titleWrap, { clearProps: 'transform' })
    if (seal) seal.style.willChange = 'auto'
    if (detailButton) {
      gsap.set(detailButton, { '--hero-ripple-scale': 1.45, '--hero-ripple-opacity': 0 })
    }
    if (typeof onComplete === 'function') onComplete()
  })

  return tl
}

/* ──────────────────────────────────────────────────────────
 * 二、三层同向鼠标视差（收官整合：视频 ±8 / 立绘 ±20 / 文字 ±4）
 *   方向约定：鼠标在 Hero 中心左侧 → 各层向左轻移；右侧同理。
 *   归一化 [-1,1]，共用同驱动值；pointermove passive 只写 target，
 *   rAF 阻尼跟随 current += (target - current) * 0.06（只写 transform）。
 *   三条铁律：
 *     - 视频层视差写 .hero-media 的 translate（不与 video 的 scale 冲突）
 *     - 文本层视差写 .hero-float 的 translate（不与 GSAP 墨迹显形冲突）
 *     - 立绘层写 .hero-art 的 translate（占位图，预留）
 *   单实例；鼠标移出回归 0；hover:none 禁用。
 * ────────────────────────────────────────────────────────── */
export function initHeroParallax() {
  if (!isDesktop()) return
  const hero = document.querySelector('#top')
  if (!hero) return
  const media = hero.querySelector('.hero-media')      // 视频背景层 wrapper
  const art = hero.querySelector('.hero-art')          // 立绘层（占位）
  const float = hero.querySelector('.hero-float')      // 文本层 wrapper
  const layers = [
    { el: media, amp: 8,   willChange: true },  // 视频背景 ±8px
    { el: art,   amp: 20,  willChange: true },  // 立绘 ±20px
    { el: float, amp: 4,   willChange: true },  // 文本 ±4px
  ].filter((l) => l.el)

  layers.forEach((l) => {
    if (l.willChange) l.el.style.willChange = 'transform'
  })

  // 各层当前/目标值（x,y）
  const state = layers.map(() => ({ cx: 0, cy: 0, tx: 0, ty: 0 }))
  let targetX = 0, targetY = 0

  // 指针处理：零分配（只写标量目标），随后唤醒单一循环
  const onMove = (e) => {
    const r = hero.getBoundingClientRect()
    if (!r.width || !r.height) return
    targetX = ((e.clientX - r.left) / r.width) * 2 - 1   // -1 ~ 1
    targetY = ((e.clientY - r.top) / r.height) * 2 - 1
    heroLoop.wake()
  }
  // 鼠标移出 Hero：目标缓回 0
  const onLeave = () => {
    targetX = 0; targetY = 0
    heroLoop.wake()
  }
  // 页面切后台立即清零目标——后台 rAF 被挂起，避免切回瞬间一次大位移
  const onVis = () => {
    if (document.hidden) { targetX = 0; targetY = 0 }
  }
  document.addEventListener('visibilitychange', onVis)

  // 单一循环任务：返回 true = 还在跟随（需要下一帧），false = 已收敛（循环自动停转）
  const tick = () => {
    let moving = false
    layers.forEach((l, i) => {
      const s = state[i]
      s.cx += (targetX - s.cx) * 0.06
      s.cy += (targetY - s.cy) * 0.06
      if (Math.abs(targetX - s.cx) > 0.001 || Math.abs(targetY - s.cy) > 0.001) moving = true
      // 只写 translate3d（GPU 合成）；不碰 scale/opacity
      l.el.style.transform = `translate3d(${(s.cx * l.amp).toFixed(2)}px, ${(s.cy * l.amp).toFixed(2)}px, 0)`
    })
    return moving
  }
  heroLoop.add(tick)

  hero.addEventListener('pointermove', onMove, { passive: true })
  hero.addEventListener('pointerleave', onLeave, { passive: true })

  // 暴露清理函数（Hero 卸载时移除监听并摘掉循环任务）
  return () => {
    document.removeEventListener('visibilitychange', onVis)
    hero.removeEventListener('pointermove', onMove)
    hero.removeEventListener('pointerleave', onLeave)
    heroLoop.remove(tick)
    layers.forEach((l) => { l.el.style.willChange = '' })
  }
}

/* ──────────────────────────────────────────────────────────
 * 三、叠层转场（sticky 覆盖）—— 取代旧的"滚出"语义
 *   布局：Hero 与档案同处 .cover-pair 撑高容器；Hero 在容器内 sticky top:0 钉住，
 *         档案（相对定位 + 不透明底 + 更高 z-index）自下而上平直覆盖；
 *         容器滚完后 Hero 随容器离开视口，其余板块常规滚动
 *   进度：第一区块 top 从"视口底"升到"视口顶" = 覆盖进度 0→1
 *   驱动：① 内容层淡出上移（保留原穿透观感）
 *         ② 视频 + 画布【同步】scale 1→1.08（幅度减半，规格要求）
 *         ③ 覆盖 100% → 暂停视频与 WebGL 渲染；回到可见区自动恢复
 * ────────────────────────────────────────────────────────── */

/* 布局开关：首屏高度 ≤ 视口时才启用 sticky（矮屏/横屏自动退回常规滚动，避免内容被钉住看不全） */
function initCoverLayout() {
  const site = document.querySelector('.site')
  const hero = document.querySelector('#top')
  if (!site || !hero) return () => {}
  const sync = (refresh = true) => {
    site.classList.toggle('cover-on', hero.offsetHeight <= window.innerHeight + 2)
    // 实验模式 B：每块钉在视口底部（--stick-top = 100vh − 该块高度，逐块计算）
    if (site.dataset.cover === 'all') {
      site.querySelectorAll('main section:not(.hero)').forEach((s) => {
        s.style.setProperty('--stick-top', `calc(100vh - ${Math.round(s.offsetHeight)}px)`)
      })
    }
    // sticky 布局生效/失效会改变层叠与几何，统一在下一帧刷新 ScrollTrigger，
    // 保证所有入场动画的触发位置与文档流一致（规格 Bug2 修复规则 2）
    if (refresh) requestAnimationFrame(() => ScrollTrigger.refresh())
  }
  sync(false) // 初次布局由 App 启动序列统一 refresh；后续 resize 仍即时刷新
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null
  if (ro) ro.observe(hero)
  window.addEventListener('resize', sync)
  return () => {
    if (ro) ro.disconnect()
    window.removeEventListener('resize', sync)
    site.classList.remove('cover-on')
  }
}

/* will-change 卫生（规格 §三.4）：区块只在"进入视口前 100vh ~ 离开后 100vh"挂提升，
   滚动静止 2s 后摘掉，避免常驻合成层 */
function initStickyHygiene() {
  const site = document.querySelector('.site')
  if (!site) return () => {}
  // 只对"覆盖层档案"做提升（Hero 自身的合成层已由 .hero-media 等 will-change 承担，
  // 不必再给 sticky 元素挂 ST —— 修复四：ScrollTrigger 一律不绑定 sticky 元素）。
  // 其余板块保持常规滚动，不挂 will-change（避免无谓的合成层与层叠上下文）
  const sections = Array.from(site.querySelectorAll('.cover-pair > #profile'))
  const sts = sections.map((s) => ScrollTrigger.create({
    trigger: s,
    start: 'top bottom+=100%',
    end: 'bottom top-=100%',
    onToggle: (self) => s.classList.toggle('is-cover-ready', self.isActive),
  }))
  let idleTimer = 0
  const onScroll = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => sections.forEach((s) => s.classList.remove('is-cover-ready')), 2000)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    sts.forEach((st) => st.kill())
    clearTimeout(idleTimer)
    window.removeEventListener('scroll', onScroll)
    sections.forEach((s) => s.classList.remove('is-cover-ready'))
    ScrollTrigger.refresh()
  }
}

export function initHeroCover(getFluid) {
  if (isReduce()) return () => {}
  const hero = document.querySelector('#top')
  if (!hero) return () => {}
  const content = hero.querySelector('.hero-inner')
  const hint = hero.querySelector('.hero-scroll-hint')
  const video = hero.querySelector('.hero-video')
  const canvas = hero.querySelector('.hero-canvas')
  const firstAfter = hero.nextElementSibling   // 紧随首屏的第一个区块
  if (!firstAfter) return () => {}

  // scale 必须【视频 + 画布同步】，否则水波层与视频层错位（规格 §三.1）
  const scalables = [video, canvas].filter(Boolean)
  const fluidNow = () => typeof getFluid === 'function' ? getFluid() : getFluid
  let lastP = -1

  const st = ScrollTrigger.create({
    trigger: firstAfter,
    start: 'top bottom',   // 下一区块刚露头 → 覆盖开始
    end: 'top top',        // 下一区块顶到视口顶 → 首屏被完全覆盖
    onUpdate: (self) => {
      const p = self.progress
      if (Math.abs(p - lastP) < 0.0005) return   // 微小变化不写 DOM，省重排
      lastP = p

      // ① 内容淡出上移（原滚动穿透观感，范围改为覆盖进度）
      if (content) {
        content.style.opacity = String(1 - p)
        content.style.transform = `translate3d(0, ${(-60 * p).toFixed(2)}px, 0)`
      }
      if (hint) hint.style.opacity = String(1 - p)

      // ② 视频 + 画布同步放大 1 → 1.08
      const s = (1 + 0.08 * p).toFixed(3)
      scalables.forEach((el) => { el.style.transform = `scale(${s})` })

      // ③ 覆盖 100% → 停视频与 WebGL；回到可见区自动恢复
      const covered = p >= 0.995
      if (covered !== heroCovered) {
        heroCovered = covered
        hero.classList.toggle('is-covered', covered)
        if (covered) {
          video?.pause()
          fluidNow()?.setPaused(true)
        } else {
          fluidNow()?.setPaused(false)
          if (video && !isReduce() && !document.hidden) video.play().catch(() => {})
        }
      }
    },
  })
  return () => { st.kill() }
}

/* ──────────────────────────────────────────────────────────
 * 三b、Hero 视频播放控制（passive 生命周期管理）
 *   1. video canplay 后给 .hero-media 加 .is-loaded → poster 0.8s 交叉淡出，
 *        video 同时淡入（不触发 React 重渲染，无黑屏无闪白）
 *   2. play() 兜底自动播放（浏览器策略有时阻止 autoplay，catch 忽略）
 *   3. IntersectionObserver：Hero 滚出视口 pause()，回视口 play()
 *   4. document.hidden 时同样暂停（省电/省主线程）
 *   返回 cleanup。
 * ────────────────────────────────────────────────────────── */
export function initHeroVideo() {
  const hero = document.querySelector('#top')
  if (!hero) return () => {}
  const media = hero.querySelector('.hero-media')
  const video = hero.querySelector('.hero-video')
  const observers = []
  let videoReady = false

  // 可播放条件 = 允许动效 + 页面可见 + 未被下一区块覆盖。
  // 【不再】包含"文字时间轴是否播完"：两条轨道必须并行，视频就绪即淡入、即播放。
  // reduced-motion 仍不播（既有降级：显示 poster 静帧）。
  const canPlay = () => !isReduce() && !document.hidden && !heroCovered

  const revealAndPlay = () => {
    if (!videoReady || !canPlay()) return
    if (media) media.classList.add('is-loaded')   // 0.8s 交叉淡入：与文字动效同时进行，互不等待
    if (video) video.play().catch(() => {})
  }

  // —— video 已就绪且 Hero 在视口时保持播放 ——
  const onCanPlay = () => {
    videoReady = true
    revealAndPlay()
  }

  // 交叉淡入结束后把 poster 移出渲染（纯事件驱动，不用 setTimeout 估算动画时长）
  const poster = hero.querySelector('.hero-poster')
  const onPosterFaded = (e) => {
    if (e.target !== poster || e.propertyName !== 'opacity') return
    if (media?.classList.contains('is-loaded')) media.classList.add('is-crossfaded')
  }
  if (poster) poster.addEventListener('transitionend', onPosterFaded)

  if (video) {
    video.addEventListener('canplay', onCanPlay)
    // 若 video 已就绪（缓存命中，canplay 已过）：直接触发一次淡入/播放
    if (video.readyState >= 3) onCanPlay()

    // 视口进出：在视口播放 / 离开暂停（单 IO，无需 scroll 监听）
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && canPlay()) revealAndPlay()
          else video.pause()
        })
      }, { rootMargin: '120px 0px' })
      io.observe(hero)
      observers.push(io)
    }

    // 切标签页暂停 / 回来恢复
    const onVisibility = () => {
      if (document.hidden) video.pause()
      else revealAndPlay()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ★ 初始化时立即调用 play()（muted + playsinline 允许自动播放）：
    //   ① 满足"视频轨道不得挂在任何时间轴回调上"的要求
    //   ② 同时触发缓冲：preload="metadata" 下若不主动 play，canplay 可能迟迟不触发（鸡生蛋）
    video.play().catch(() => {})
    // 初始：若已在视口（首屏顶部）则直接尝试淡入
    revealAndPlay()

    return () => {
      video.removeEventListener('canplay', onCanPlay)
      document.removeEventListener('visibilitychange', onVisibility)
      poster?.removeEventListener('transitionend', onPosterFaded)
      observers.forEach((o) => o.disconnect())
      video.pause()
    }
  }
  // 无 video 元素（如 Hero 未渲染）：空清理
  return () => {}
}

/* ──────────────────────────────────────────────────────────
 * 四、countUp —— 数字滚动（供 React 未覆盖的静态数字用）
 *   countUp(el, target, { duration, decimals, suffix })
 * ────────────────────────────────────────────────────────── */
export function countUp(el, target, { duration = 1.8, decimals = 0, suffix = '', triggerDelay = 0, fromCurrent = true } = {}) {
  if (!el) return
  const fmt = (n) => {
    const fixed = n.toFixed(decimals)
    const [int, dec] = fixed.split('.')
    const gi = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return (dec !== undefined ? `${gi}.${dec}` : gi) + suffix
  }
  if (isReduce()) { el.textContent = fmt(target); return }

  // 单例：先杀掉该元素上已有的计数 tween，禁止两个计数动画并行
  if (el._countTween) { el._countTween.kill() }
  // 从当前显示值继续（若之前滚动到一半被中断，不会跳回 0）
  let startVal = 0
  if (fromCurrent) {
    const cur = parseFloat(String(el.textContent).replace(/[^\d.\-]/g, ''))
    if (!Number.isNaN(cur)) startVal = cur
  }
  const obj = { v: startVal }
  el._countTween = gsap.to(obj, {
    v: target, duration, ease: 'power2.out',
    delay: triggerDelay, // 入场完成后启动
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    onUpdate: () => { if (el) el.textContent = fmt(obj.v) },
    onComplete: () => { el._countTween = null },
  })
}

/* ──────────────────────────────────────────────────────────
 * 五、卡片 hover 五层反馈（桌面端）
 *   基础：3D tilt（quickTo 跟随）+ 稀有度色光标光晕
 *   叠加：剑光扫过（每次移入一次）、稀有度描边/发光、皮肤词条点亮
 *   bindTiltCard(card)：单卡绑定（data-tilt-bound 防重）。
 *   tab 面板重建后新卡片也会调用它 —— 新 DOM 节点无标记 → 正常绑定；
 *   已绑定的旧元素跳过 → 无监听器/节点堆积
 * ────────────────────────────────────────────────────────── */
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common']
const CARD_RARITY_RGB = { legendary: '212, 175, 88', epic: '176, 96, 224', rare: '56, 164, 232' }
export function bindTiltCard(card) {
  if (!isDesktop() || !card || card.dataset.tiltBound) return
  card.dataset.tiltBound = '1' // 单例：只绑定一次（含节点注入 + 监听器）

  // —— 卡级颜色 ——
  // 英雄卡已改为「英雄主题色」：HeroCard 直接注入 --hero-theme-rgb，不再依赖品质。
  // 这里只给武器卡/构筑卡注入卡级稀有度色，作为 CSS 的第二优先级回退（前者未定义时生效）
  if (!card.classList.contains('hero-card')) {
    let top = 'common'
    card.querySelectorAll('.skin-rarity').forEach((el) => {
      const map = { '传说': 'legendary', '史诗': 'epic', '稀有': 'rare', '普通': 'common' }
      // 与下面两处（initRarityGlow / tabchange）同约定：档位以【数据】为准，只在缺属性时才回退查文案。
      // 否则标签一自定义（如「极品」），这里会静默退化成 common。
      const k = el.closest('.skin-item')?.dataset.rarity || map[el.textContent]
      if (k && RARITY_ORDER.indexOf(k) < RARITY_ORDER.indexOf(top)) top = k
    })
    card.style.setProperty('--card-rarity-rgb', CARD_RARITY_RGB[top] || '212, 175, 88')
  }

  const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' })
  const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' })

  // 光标高光层（稀有度色由 CSS 读取 --card-rarity-rgb）：单例，不存在才创建
  let glow = card.querySelector('.tilt-glow')
  if (!glow) {
    glow = document.createElement('span')
    glow.className = 'tilt-glow'
    card.appendChild(glow)
  }

  // 剑光层：裁剪容器 + 斜向光带（仅英雄/武器卡，build-card 不做）：单例注入
  //   容器 = 共面裁剪框（CSS 负责，勿加 translateZ，见 index.css 注释）；光带 = 旋转窄带
  const isSheenCard = card.matches('.hero-card, .weapon-card')
  if (isSheenCard && !card.querySelector('.card-clip')) {
    const clip = document.createElement('span')
    clip.className = 'card-clip'
    const band = document.createElement('span')
    band.className = 'card-sheen'
    clip.appendChild(band)
    card.appendChild(clip)
  }
  const sheen = isSheenCard ? card.querySelector('.card-sheen') : null

  const moveGlow = gsap.quickTo(glow, 'backgroundPosition', { duration: 0.3, ease: 'power2.out' })

  // 剑气擦过：每次移入只播一次 —— 先摘 class 回到起点 + 强制 reflow，再挂 class 起跑
  //   （同帧重入也能从头重播，无残影叠加；禁循环）；移出立即复位，自然结束也复位。
  //   原 sheenLock 已删：reduced-motion 下 CSS 是 display:none、不会触发 animationend，
  //   锁一旦置位就永久卡死；现在无锁，重入即自愈。
  if (sheen) {
    card.addEventListener('mouseenter', () => {
      card.classList.remove('is-sheen')
      void card.offsetWidth
      card.classList.add('is-sheen')
    })
    card.addEventListener('mouseleave', () => card.classList.remove('is-sheen'))
    sheen.addEventListener('animationend', () => card.classList.remove('is-sheen'))
  }

  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    ry((px - 0.5) * 16)  // 最大 ±8deg
    rx((0.5 - py) * 16)
    glow.style.opacity = 1
    moveGlow(`${px * 100}% ${py * 100}%`)
    glow.style.setProperty('--gx', `${px * 100}%`)
    glow.style.setProperty('--gy', `${py * 100}%`)
  })
  card.addEventListener('mouseleave', () => {
    rx(0); ry(0); glow.style.opacity = 0
  })
}

export function initTilt() {
  if (!isDesktop()) return
  document.querySelectorAll('.hero-card, .weapon-card, .build-card').forEach(bindTiltCard)
}

/* ──────────────────────────────────────────────────────────
 * 六、稀有度"静态描边 + 呼吸光晕"（方案A）
 *   静态：1.5px 稀有度色描边（卡面静止）；唯一循环动画 = box-shadow 呼吸
 *   同步铁律：animation-delay 全 0，同品质卡片同时呼吸，无 stagger
 * ────────────────────────────────────────────────────────── */
const RARITY_RGB = { legendary: '212, 175, 55', epic: '176, 96, 224', rare: '56, 164, 232' }
export function initRarityGlow() {
  if (isReduce()) return
  const skins = document.querySelectorAll('.skin-item')
  skins.forEach((item) => {
    if (item.dataset.glowBound) return
    const rarityEl = item.querySelector('.skin-rarity')
    if (!rarityEl) return
    // 稀有度以【数据】为准（HeroCard 写的 data-rarity）；只有没有该属性时才回退按文案查表
    // —— 标签文案允许自定义（如「极品」），行为不能跟着文案走
    const map = { '传说': 'legendary', '史诗': 'epic', '稀有': 'rare', '普通': 'common' }
    const key = item.dataset.rarity || map[rarityEl.textContent]
    if (!key) return
    item.dataset.glowBound = '1' // 单例：只处理一次
    // 注入稀有度 RGB 三元组（配 rgba 透明度做描边 + 呼吸）
    item.style.setProperty('--rarity-rgb', RARITY_RGB[key] || '127, 139, 147')
    // 清掉内联边框色/宽度：让 CSS 类统一按稀有度控制静态描边（不覆盖背景静止层）
    item.style.borderColor = ''
    item.style.borderWidth = ''
    if (key === 'common') item.classList.add('rarity-breathe--common')
    else item.classList.add('rarity-breathe')
  })
}

/* ──────────────────────────────────────────────────────────
 * 六b、呼吸光晕视口外暂停（修复三）
 *   视口内呼吸动画播放（opacity 走合成器），滚出视口的卡暂停 -- 恢复，
 *   且恢复不带 delay（严禁为此加延迟）。IO 单例防重。
 * ────────────────────────────────────────────────────────── */
export function initBreathPause() {
  if (isReduce()) return
  const items = document.querySelectorAll('.rarity-breathe:not(.rarity-breathe--common)')
  items.forEach((item) => {
    if (item.dataset.breathBound) return
    item.dataset.breathBound = '1'
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        item.classList.toggle('is-out', !entry.isIntersecting)
      })
    }, { rootMargin: '120px 0px' })
    io.observe(item)
    // 不保留引用：元素随 tab 面板销毁时 IO 自动 GC（observer 自身无外部引用会随目标回收）
    item._breathIO = io
  })
}

/* ──────────────────────────────────────────────────────────
 * 六c、Hero 区滚出视口后暂停装饰循环动画（修复六：视口外工作削减）
 *   水墨漂移/尘埃上浮/滚动提示脉冲/Ken Burns 都是无限循环，
 *   Hero 滚出后继续跑纯属浪费主线程。IO 控制 .paused 类，
 *   所有动画统一挂 .hero-anims 根（只暂停，恢复直接继续，不带 delay）：
 *   用 animation-play-state：paused 强制单层暂停，视觉零跳变。
 * ────────────────────────────────────────────────────────── */
export function initHeroPause() {
  if (isReduce()) return
  const hero = document.querySelector('#top')
  if (!hero || !('IntersectionObserver' in window)) return
  if (hero.dataset.heroPauseBound) return
  hero.dataset.heroPauseBound = '1'
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      hero.classList.toggle('is-out', !entry.isIntersecting)
    })
  }, { rootMargin: '200px 0px' })
  io.observe(hero)
}

/* ──────────────────────────────────────────────────────────
 * 六d、色彩呼吸（P1，2026-09-22 新增）
 *   参考 phantom 首页的「氛围球多色渐变呼吸 / 霓虹发光文字变色呼吸」：
 *   那两处动的**不是** background / color 本身，而是一组 CSS 颜色变量，
 *   渐变与 text-shadow 跟着变量一起变。
 *   这里用 GSAP 直接补间 CSS 自定义属性（GSAP 对自定义属性做颜色插值）——
 *   所以**不需要 @property 注册**，也不引入任何新依赖。
 *   两个目标都是「已存在的元素 + 把写死的色值换成变量」，变量起始值 = 改前的值
 *   → JS 未运行 / reduced-motion 时渲染与改动前逐字一致（可零风险回退）。
 *   视口外一律 pause()，与 initBreathPause / initHeroPause 同一套 IO 约定。
 * ────────────────────────────────────────────────────────── */
export function initColorBreath() {
  if (isReduce()) return

  const bind = (el, vars, duration) => {
    if (!el || el.dataset.colorBreathBound) return
    el.dataset.colorBreathBound = '1' // 单例：切 Tab / 重复 init 不叠加 tween
    const tw = gsap.to(el, { ...vars, duration, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? tw.play() : tw.pause()))
    }, { rootMargin: '150px 0px' })
    io.observe(el)
    el._colorBreathIO = io
  }

  // 目标 1｜首屏「氛围球」：两团墨迹光晕，各走一条独立色相 —— 时长 9s / 13s 互质错相位，
  //   冷墨蓝 与 主题金 之间缓慢往复
  bind(document.querySelector('#top .ink-1'), { '--ink-1-c': 'rgba(146, 186, 255, .18)' }, 9)
  bind(document.querySelector('#top .ink-2'), { '--ink-2-c': 'rgba(212, 175, 88, .14)' }, 13)

  // 目标 2｜「发光文字」：征神之路的金色数码大字，辉光在金色与暖白之间呼吸
  bind(document.querySelector('.zs-big'), { '--zs-glow': 'rgba(255, 236, 182, .58)' }, 7)
}

/* ──────────────────────────────────────────────────────────
 * 七、魂玉词条依次点亮（卡片入场后，间隔 100ms）
 * ────────────────────────────────────────────────────────── */
export function initJadeLight() {
  if (isReduce()) return
  const cards = document.querySelectorAll('.build-card')
  cards.forEach((card) => {
    // 单例：已绑定过的卡片跳过（tabchange 重扫时不再重复创建 ScrollTrigger）
    if (card.dataset.jadeBound) return
    const jades = Array.from(card.querySelectorAll('.jade-chip'))
    if (!jades.length) return
    card.dataset.jadeBound = '1'
    gsap.set(jades, { opacity: 0.25, scale: 0.9 })
    ScrollTrigger.create({
      trigger: card,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.delayedCall(0.6, () => {
          gsap.to(jades, {
            opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)',
            stagger: 0.1,
            onComplete: () => jades.forEach((j) => { j.style.willChange = 'auto' }),
          })
        })
      },
    })
  })
}

/* ──────────────────────────────────────────────────────────
 * 八、全局噪点纹理（feTurbulence，消除暗色色带）
 * ────────────────────────────────────────────────────────── */
export function initGrain() {
  if (isReduce()) return
  if (document.querySelector('.grain-overlay')) return
  const div = document.createElement('div')
  div.className = 'grain-overlay'
  div.setAttribute('aria-hidden', 'true')
  document.body.appendChild(div)
}

/* ──────────────────────────────────────────────────────────
 * 九、顶部滚动进度条（2px，随滚动填充）
 * ────────────────────────────────────────────────────────── */
export function initProgressBar() {
  if (isReduce()) return
  let bar = document.querySelector('.scroll-progress')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'scroll-progress'
    bar.setAttribute('aria-hidden', 'true')
    document.body.appendChild(bar)
  }
  gsap.set(bar, { scaleX: 0 })
  gsap.to(bar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: document.documentElement,
      start: 0,
      end: () => ScrollTrigger.maxScroll(window),
      scrub: 0.3,
    },
  })
}

/* ──────────────────────────────────────────────────────────
 * 十、复制按钮脉冲（点击 scale 一下；文字 1.5s 后复原由 React 控制）
 * ────────────────────────────────────────────────────────── */
export function initCopyPulse() {
  if (isReduce()) return
  document.querySelectorAll('.btn-primary').forEach((btn) => {
    btn.addEventListener('click', () => {
      gsap.fromTo(btn,
        { scale: 1 },
        { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'scale' }
      )
    })
  })
}

/* ──────────────────────────────────────────────────────────
 * 统一入口：App 挂载后调用
 * ────────────────────────────────────────────────────────── */
export default function initFx() {
  initGrain()
  initProgressBar()
  // 首屏时序保护：字体/资源就绪（join.js 派发 hero-ready）后才允许播 Hero 墨迹。
  // hash 直达其他板块时不消费这次播放机会；用户首次滚回顶部后再完整播放一次。
  let heroReady = false
  let heroPlayed = false
  let fluid = null
  const heroEl = document.querySelector('#top')

  const startFluid = () => {
    if (fluid || isReduce()) return
    fluid = initFluidHero({
      hero: heroEl,
      video: heroEl?.querySelector('.hero-video'),
      canvas: heroEl?.querySelector('.hero-canvas'),
      config: effects.ripple,
      wake: heroLoop.wake,
    })
    if (fluid) heroLoop.add(fluid.tick)
  }

  // 文案时间轴播完只做一件事：对外通知（App 借此启动 Lenis 平滑滚动）。
  // 视频与 WebGL 【不在这里启动】—— 它们从初始化起就并行运行，不再等任何动画。
  const onHeroMotionComplete = () => {
    window.dispatchEvent(new CustomEvent('hero-motion-complete'))
  }

  const tryPlayHero = () => {
    if (!heroReady || heroPlayed) return
    const landing = window.__bootLanding
    const atTop = !landing || landing.top === true
    if (!atTop && window.scrollY >= 60) return
    heroPlayed = true
    const tl = playHeroMotion(onHeroMotionComplete)
    if (!tl) onHeroMotionComplete()
  }
  const onHeroReady = () => {
    heroReady = true
    tryPlayHero()
  }
  window.addEventListener('hero-ready', onHeroReady)
  window.addEventListener('scroll', tryPlayHero, { passive: true })

  // Hero 区：三层视差（单一循环阻尼）+ 视频播放管理（poster 淡入/视口暂停恢复）
  const cleanupParallax = initHeroParallax()
  const cleanupVideo = initHeroVideo()
  // 水波（WebGL）立即启动：它只在"收到视频新帧"（rVFC）时才上传/绘制，
  // 因此"启动条件 = 视频首帧纹理就绪 + Hero 可见"天然成立，与文字时间轴无关
  startFluid()

  // 叠层转场：布局开关（sticky）+ 覆盖进度驱动 + will-change 卫生
  const cleanupCoverLayout = initCoverLayout()
  const cleanupCover = initHeroCover(() => fluid)
  const cleanupHygiene = initStickyHygiene()

  initTilt()
  initRarityGlow()
  initBreathPause()
  initHeroPause()
  initColorBreath()
  initJadeLight()
  initCopyPulse()

  // 静态数字滚动（非 StatCard 的数字，如游戏时长/征神等级）
  // 已由 choreo.js 接管编排的数字（dataset.choreoCount）跳过，避免双重滚动
  document.querySelectorAll('[data-count]').forEach((el) => {
    if (el.dataset.choreoCount) return
    const target = Number(el.dataset.count)
    if (!Number.isNaN(target)) countUp(el, target, { duration: 1.8 })
  })

  // Tab 切换后：新面板淡入 + 卡片重新错峰入场
  // （initRarityGlow/initJadeLight 已有元素级防重标记，新面板元素会自动绑定，
  //   全站旧元素不再被重复处理 → 无实例堆积）
  const onTabChange = () => {
    const tabchangeRaf = () => {
      // 1. 新面板整体淡入（opacity 0→1 + y 12→0，0.4s）
      const panel = document.querySelector('.tab-panel')
      if (panel && !isReduce()) {
        gsap.killTweensOf(panel)
        gsap.set(panel, { clearProps: 'opacity,transform' })
        gsap.fromTo(panel, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
      }

      // 2. 新面板内流光/魂玉绑定（元素级防重标记保证不重复创建实例）
      const panelSkins = Array.from(panel?.querySelectorAll('.skin-item') || [])
      panelSkins.forEach((item) => {
        if (item.dataset.glowBound) return
        const rarityEl = item.querySelector('.skin-rarity')
        if (!rarityEl) return
        const map = { '传说': 'legendary', '史诗': 'epic', '稀有': 'rare', '普通': 'common' }
        const key = item.dataset.rarity || map[rarityEl.textContent]  // 同上：数据优先
        if (!key) return
        item.dataset.glowBound = '1'
        item.style.setProperty('--rarity-rgb', RARITY_RGB[key] || '127, 139, 147')
        item.style.borderColor = ''
        item.style.borderWidth = ''
        if (key === 'common') item.classList.add('rarity-breathe--common')
        else item.classList.add('rarity-breathe')
      })
      // 新面板呼吸光晕同样进视口外暂停管辖（IO 防重标记保证不重复绑定）
      initBreathPause()
      const panelBuilds = Array.from(panel?.querySelectorAll('.build-card') || [])
      panelBuilds.forEach((card) => {
        if (card.dataset.jadeBound) return
        const jades = Array.from(card.querySelectorAll('.jade-chip'))
        if (!jades.length) return
        card.dataset.jadeBound = '1'
        gsap.set(jades, { opacity: 0.25, scale: 0.9 })
        ScrollTrigger.create({
          trigger: card,
          start: 'top 82%',
          once: true,
          onEnter: () => gsap.delayedCall(0.6, () => gsap.to(jades, {
            opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.1,
            onComplete: () => jades.forEach((j) => { j.style.willChange = 'auto' }),
          })),
        })
      })

      // 3. 新面板内卡片中心展开（元素无 bound 标记 → 绑定）
      document.querySelectorAll('.tab-panel [data-reveal-group]').forEach((group) => {
        const cards = Array.from(group.children).filter(
          (c) => c.dataset.reveal !== 'none' && !c.hasAttribute('data-reveal-group')
        )
        if (!cards.length) return
        const total = cards.length
        cards.forEach((card, i) => {
          const center = (total - 1) / 2
          const dist = i - center
          const delay = Math.abs(dist) * 0.12
          const fromX = Math.abs(dist) < 0.001 ? 0 : (dist < 0 ? 1 : -1) * (60 + Math.floor(Math.abs(dist) + 0.5) * 20)
          revealCard(card, delay, fromX)
        })
      })

      // 2b. 新面板内 tilt 卡片补绑定（新 DOM 无 tilt-bound 标记 → 正常注入剑光/光晕）
      panel?.querySelectorAll('.hero-card, .weapon-card, .build-card').forEach(bindTiltCard)

      // 3. 新面板内静态数字滚动（面板入场后启动；非面板区数字绝不重刷）
      document.querySelectorAll('.tab-panel [data-count]').forEach((el) => {
        if (el.dataset.choreoCount) return
        const target = Number(el.dataset.count)
        if (!Number.isNaN(target)) countUp(el, target, { duration: 1.8, triggerDelay: 0.4 })
      })
    }
    requestAnimationFrame(() => requestAnimationFrame(tabchangeRaf))
  }
  document.addEventListener('tabchange', onTabChange)

  // 返回清理函数：App 卸载时移除监听，防止 StrictMode 双绑/泄漏
  return () => {
    window.removeEventListener('hero-ready', onHeroReady)
    window.removeEventListener('scroll', tryPlayHero)
    document.removeEventListener('tabchange', onTabChange)
    cleanupParallax?.()
    cleanupVideo?.()
    if (fluid) { heroLoop.remove(fluid.tick); fluid.destroy() }
    cleanupCover?.()
    cleanupCoverLayout?.()
    cleanupHygiene?.()
  }
}
