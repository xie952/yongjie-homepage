import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ════════════════════════════════════════════════════════════
 * 板块入场编排（choreo.js）—— 统一入场语言
 * ------------------------------------------------------------
 * 覆盖四个板块（+征神数字排）：
 *   01 玩家档案 #profile
 *   02 天选之人 #tianxuan（标题/tab/徽章/数据 + 常用英雄/武器卡）
 *   03 征神之路 #zhengshen 的数字排（等级/十殿门/对局/印/成就）
 * 语言规范：
 *   - 缓动 cubic-bezier(0.22, 1, 0.36, 1)
 *   - 时长 0.6~1.1s；质感 = 位移 + 模糊 + 微缩放（禁裸位移）
 *   - ScrollTrigger start 'top 78%'，once，已在视口内立即播
 *   - 每板块：标题 → 主体 → 细节 三层，重叠 ~30%
 * 与旧系统隔离：接管元素上剥离 data-reveal* 属性 + 打 data-choreo
 *   标记 → animations/fx 的通用扫描不再绑定它们（无双重动画）。
 *   Tab 切换后新面板由既有 fx tabchange 系统接管（本模块只做首屏）。
 * 约束：reduced-motion 直接跳过（内容可见）；动画结束清 transform/filter
 * ════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1]
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* 简单数字滚动（choreo 内部使用，千分位，整数） */
function rollNumber(el, target, dur = 1.2) {
  if (!el) return
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const obj = { v: 0 }
  gsap.to(obj, {
    v: target, duration: dur, ease: 'power2.out',
    onUpdate: () => { if (el) el.textContent = fmt(obj.v) },
  })
}

/* 标题拆字：mode-title-cn 中文逐字 / en 整体，供模糊显形 */
function splitTitleChars(el) {
  if (!el || el.dataset.titleDone) return []
  el.dataset.titleDone = '1'
  const text = el.textContent
  el.textContent = ''
  const spans = Array.from(text).map((ch) => {
    const s = document.createElement('span')
    s.className = 'choreo-char'
    s.textContent = ch
    if (/\s/.test(ch)) s.innerHTML = '&nbsp;'
    el.appendChild(s)
    return s
  })
  return spans
}

/* 把 <p> 的文本按“真实折行”切成 .mask-line > .mask-line-inner 行遮罩结构 */
function splitBioLines(el) {
  if (!el || el.dataset.linesDone) return []
  el.dataset.linesDone = '1'
  const raw = el.textContent
  el.textContent = ''
  if (!raw) return []

  // 用 canvas 按实际字号测量每行可容纳的字数
  const cs = getComputedStyle(el)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
  const maxW = el.clientWidth - padL - padR

  const lines = []
  let cur = ''
  let curW = 0
  for (const ch of raw) {
    const w = ctx.measureText(ch).width
    if (curW + w > maxW && cur) { lines.push(cur); cur = ch; curW = w }
    else { cur += ch; curW += w }
  }
  if (cur) lines.push(cur)

  const innerEls = []
  lines.forEach((lineText) => {
    const line = document.createElement('span')
    line.className = 'mask-line'
    const inner = document.createElement('span')
    inner.className = 'mask-line-inner'
    inner.textContent = lineText
    line.appendChild(inner)
    el.appendChild(line)
    innerEls.push(inner)
  })
  return innerEls
}

/* 把 run 内旧通用标记摘掉（交 choreo 编排），再打 data-choreo。
   data-reveal / data-reveal-group / data-split 是独立属性名，分别移除；
   excludeEls（Set）命中的元素保留旧属性（仍由 animations 通用系统绑定） */
function takeOver(run, excludeEls = new Set()) {
  run.querySelectorAll('[data-reveal], [data-reveal-group], [data-split]').forEach((el) => {
    if (excludeEls.has(el)) return
    el.removeAttribute('data-reveal')
    el.removeAttribute('data-reveal-group')
    el.removeAttribute('data-split')
  })
  // 数字元素标记为 choreo 已接管（fx 全站 data-count 扫描跳过，锚点重放走 replayChoreoSection）
  run.querySelectorAll('[data-count]').forEach((el) => {
    el.dataset.choreoCount = '1'
  })
  run.dataset.choreo = '1'
  return run
}

/* 保留给旧通用 reveal 系统的元素（征神 build 卡组等，不在本任务编排范围）。
   仅征神板块需要：build 卡组（.card-grid--3）与其 loadout 标题维持既有 reveal/魂玉系统 */
function keepForLegacy(section) {
  const keep = new Set()
  if (section.id !== 'zhengshen') return keep
  section.querySelectorAll('.card-grid--3, .loadout-title').forEach((el) => {
    keep.add(el)
    el.querySelectorAll('*').forEach((d) => keep.add(d))
  })
  return keep
}

/* 取板块编排时间轴（惰性构建 + paused：位置 0 的 fromTo 会立即渲染隐藏态，
   滚动到 78% 前内容保持“待播隐藏”，与原 reveal 系统体验一致） */
function ensureTl(section) {
  const id = section.id
  const builders = { profile: buildProfile, tianxuan: buildTianxuan, zhengshen: buildZhengshen }
  const build = builders[id]
  if (!build) return null
  if (section.__choreoCtx && section.__choreoTl) return section.__choreoTl
  let tl = null
  const ctx = gsap.context(() => {
    tl = build(section)
    // 性能：板块入场时间轴播完 → 打 choreo-done 标记，CSS 回收拆字 will-change
    // （合成层提示，无视觉影响；重放前会移除标记，见 replayChoreoSection）
    tl.eventCallback('onComplete', () => section.classList.add('choreo-done'))
    tl.pause(0)
  }, section)
  section.__choreoCtx = ctx
  section.__choreoTl = tl
  return tl
}

/* 滚动进入时播放（once ST 触发） */
function playSection(section) {
  if (!section || reduce()) return
  const tl = ensureTl(section)
  if (tl) tl.play(0)
}

/* 锚点重放：还原上次编排（元素回到可见终态）后重建并立即播放 */
export function replayChoreoSection(section) {
  if (!section || reduce()) return
  section.classList.remove('choreo-done') // 重放需重新提升拆字，先摘掉已完成标记
  if (section.__choreoCtx) {
    section.__choreoCtx.revert()
    section.__choreoCtx = null
    section.__choreoTl = null
  }
  playSection(section)
}

/* 主入口：为带编排的板块注册滚动触发 */
export default function initChoreo() {
  const sections = [
    document.getElementById('profile'),
    document.getElementById('tianxuan'),
    document.getElementById('zhengshen'),
  ].filter(Boolean)
  if (!sections.length) return () => {}

  const sts = []
  sections.forEach((section) => {
    // 摘除旧通用标记（保留征神 build 卡组给旧系统），标记本板块由 choreo 接管
    takeOver(section, keepForLegacy(section))
    if (reduce()) return
    // 首次滚动进入触发（top 78%，只播一次；已在视口内立即播）
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 78%',
      once: true,
      onEnter: () => playSection(section),
    })
    sts.push(st)
  })

  // 预建 paused 时间轴：等字体就绪后再拆字/测行宽（避免字体替换闪跳），
  // 之后元素即进入“隐藏待播”态，滚动到 78% 才播放。
  let disposed = false
  const buildTimelines = () => {
    if (disposed || reduce()) return
    sections.forEach((s) => ensureTl(s))
  }
  if (document.fonts?.ready) {
    document.fonts.ready.then(buildTimelines).catch(buildTimelines)
  } else {
    requestAnimationFrame(() => requestAnimationFrame(buildTimelines))
  }

  // Tab 切换：choreo 只接管首个默认面板（当前默认 trio，初始化时已挂载）。
  // 切换后新面板由 fx 既有 tabchange 系统处理，这里停用天选 ST（避免双重）。
  const onTab = () => {
    const tian = sts.find((st) => st.trigger?.id === 'tianxuan')
    if (tian) tian.kill()
  }
  document.addEventListener('tabchange', onTab, { once: true })

  return () => {
    disposed = true
    document.removeEventListener('tabchange', onTab)
    sts.forEach((st) => st.kill())
    sections.forEach((s) => {
      if (s.__choreoCtx) { s.__choreoCtx.revert(); s.__choreoCtx = null; s.__choreoTl = null }
    })
  }
}

/* —— 板块一：玩家档案 —— */
function buildProfile(section) {
  const tl = gsap.timeline({ defaults: { ease: EASE } })

  const head = section.querySelector('.mode-head')
  const cn = section.querySelector('.mode-title-cn')
  const en = section.querySelector('.mode-title-en')
  const rule = section.querySelector('.mode-rule')
  const no = section.querySelector('.mode-no')
  const portrait = section.querySelector('.profile-portrait')
  const placeholder = section.querySelector('.portrait-placeholder')
  const info = section.querySelector('.profile-info')
  const idRow = section.querySelector('.profile-id-row')
  const bio = section.querySelector('.profile-bio')
  const metrics = section.querySelector('.profile-metrics')
  const blocks = Array.from(section.querySelectorAll('.profile-block'))
  const metricNums = Array.from(section.querySelectorAll('.profile-metric-num'))
  const socialsGroup = section.querySelector('.profile-socials')
  const socialLinks = socialsGroup ? Array.from(socialsGroup.querySelectorAll('.social-link')) : []

  // 名字下方墨迹分隔线：无现成元素则注入一条装饰线
  let inkRule = section.querySelector('.profile-ink-rule')
  if (!inkRule && idRow && idRow.nextElementSibling?.classList?.contains('profile-bio')) {
    inkRule = document.createElement('span')
    inkRule.className = 'profile-ink-rule'
    inkRule.setAttribute('aria-hidden', 'true')
    idRow.after(inkRule)
  }

  // —— 第 1 层：标题（模糊显形 + 两侧横线从中心展开） ——
  let t = 0
  if (no) tl.fromTo(no, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, t)
  const cnChars = cn ? splitTitleChars(cn) : []
  if (cnChars.length) {
    gsap.set(cnChars, { opacity: 0, y: 26, filter: 'blur(8px)' })
    tl.to(cnChars, {
      opacity: 1, y: 0, filter: 'blur(0px)',
      duration: 0.95, stagger: 0.06,
      clearProps: 'filter',   // 只清 filter，保留 transform（clearTransform 不是 GSAP 属性，删）
    }, t)
  }
  if (en) tl.fromTo(en, { opacity: 0, y: 16, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, clearProps: 'filter' }, t + 0.25)
  if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.8, clearProps: 'transform' }, t + 0.35)

  // —— 第 2 层：档案卡收敛（整卡 blur10+y48+scale.97 → 归零） ——
  const titleDur = 1.0
  let t2 = t + titleDur * 0.7
  // 左卡：立绘卡收敛
  if (portrait) {
    tl.fromTo(portrait,
      { opacity: 0, y: 48, scale: 0.97, filter: 'blur(10px)' },
      { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.05, clearProps: 'filter,transform' },
      t2)
    // 立绘遮罩自下而上揭开
    if (placeholder) {
      tl.fromTo(placeholder,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, clearProps: 'clipPath' },
        t2 + 0.25)
    }
  }
  // 右卡：信息卡收敛
  const convergeDur = 1.05
  if (info) {
    tl.fromTo(info,
      { opacity: 0, y: 40, scale: 0.97, filter: 'blur(6px)' },
      { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: convergeDur, clearProps: 'filter,transform' },
      t2 + 0.1)
  }

  // —— 第 3 层：卡内细节 ——
  let t3 = t2 + convergeDur * 0.7
  // 名字下墨迹线从左向右晕开
  if (inkRule) tl.fromTo(inkRule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, clearProps: 'transform' }, t3 + 0.05)
  if (idRow) tl.fromTo(idRow, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, clearProps: 'transform' }, t3)

  // 描述段落逐行遮罩（若拆分成功则逐行，否则整段上浮）
  if (bio) {
    const innerEls = splitBioLines(bio)
    if (innerEls.length) {
      gsap.set(innerEls, { yPercent: 115 })
      tl.to(innerEls, {
        yPercent: 0, duration: 0.7, stagger: 0.09, clearProps: 'transform',
      }, t3 + 0.3)
    } else {
      tl.fromTo(bio, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, clearProps: 'transform' }, t3 + 0.25)
    }
  }

  // 数据（1,619 小时 / 2,021 年）：卡入场完成约 0.5s 后数字滚动 + 上浮
  const metricsAt = t3 + 0.8
  if (metrics) tl.fromTo(metrics, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, clearProps: 'transform' }, metricsAt)
  metricNums.forEach((numEl) => {
    const target = Number(numEl.dataset.count)
    if (!Number.isNaN(target)) tl.call(() => rollNumber(numEl, target, 1.2), [], metricsAt + 0.4)
  })

  // 常用英雄 / 常用武器 chips：上浮错峰
  blocks.forEach((blk, i) => {
    tl.fromTo(blk, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.65, clearProps: 'transform' },
      metricsAt + 0.5 + i * 0.14)
  })
  // 社交链接：最后淡入
  socialLinks.forEach((lk, i) => {
    tl.fromTo(lk, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, clearProps: 'transform' },
      metricsAt + 0.6 + blocks.length * 0.14 + i * 0.06)
  })

  return tl
}

/* —— 板块二：天选之人（初始面板：模式栏/徽章/数据网格/英雄/武器） —— */
function buildTianxuan(section) {
  const tl = gsap.timeline({ defaults: { ease: EASE } })
  const panel = section.querySelector('.tab-panel')

  const cn = section.querySelector('.mode-title-cn')
  const en = section.querySelector('.mode-title-en')
  const rule = section.querySelector('.mode-rule')
  const no = section.querySelector('.mode-no')
  const tabBar = section.querySelector('.tab-bar')
  const tabBtns = Array.from(section.querySelectorAll('.tab-btn'))
  const rankRow = panel?.querySelector('.mode-rank-row')
  const rankBadge = rankRow?.querySelector('.rank-badge')
  const statGrid = panel?.querySelector('.stat-grid')
  const statCards = statGrid ? Array.from(statGrid.children).filter((c) => c.classList.contains('stat-card')) : []
  const loadoutCols = panel ? Array.from(panel.querySelectorAll('.loadout-col')) : []

  let t = 0
  // —— 1. 标题 ——
  if (no) tl.fromTo(no, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, t)
  const cnChars = cn ? splitTitleChars(cn) : []
  if (cnChars.length) {
    gsap.set(cnChars, { opacity: 0, y: 26, filter: 'blur(8px)' })
    tl.to(cnChars, {
      opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.95,
      stagger: 0.06, clearProps: 'filter',
    }, t)
  }
  if (en) tl.fromTo(en, { opacity: 0, y: 16, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, clearProps: 'filter' }, t + 0.25)
  if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.8, clearProps: 'transform' }, t + 0.35)
  const headDur = 1.0

  // —— 2. 模式切换栏：整条上浮后 3 个 tab 依次 80ms 错峰点亮 ——
  let t2 = t + headDur * 0.7
  if (tabBar) tl.fromTo(tabBar, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, clearProps: 'transform' }, t2)
  if (tabBtns.length) {
    tl.fromTo(tabBtns,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, clearProps: 'transform' },
      t2 + 0.2)
  }

  // —— 3. 段位徽章点睛：scale .6→1 回弹 + 金色光泽扫过（一次） ——
  let t3 = t2 + 0.95 * 0.7
  const rankBlock = rankRow?.querySelector('.mode-rank-block')
  if (rankBlock) tl.fromTo(rankBlock, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, clearProps: 'transform' }, t3)
  if (rankBadge) {
    tl.fromTo(rankBadge,
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.85, ease: 'back.out(1.6)', clearProps: 'transform' },
      t3 + 0.15)
    // 一次性金色扫光（与常驻 4s 光泽区分：注入临时元素，扫完移除）
    tl.call(() => {
      const el = rankBadge
      if (!el) return
      const shine = document.createElement('span')
      shine.className = 'badge-sheen'
      shine.setAttribute('aria-hidden', 'true')
      el.appendChild(shine)
      gsap.fromTo(shine,
        { xPercent: -180, opacity: 0 },
        {
          xPercent: 260, opacity: 1, duration: 0.6, ease: 'power1.in',
          onComplete: () => {
            gsap.to(shine, { opacity: 0, duration: 0.25, onComplete: () => shine.remove() })
          },
        })
    }, [], t3 + 0.5)
  }

  // —— 4. 战斗数据网格：8 项（积分 accent + stat-grid 7 项）波浪错峰 + 数字滚动 ——
  const gridCards = []
  // rank-row 内的积分卡最先 + stat-grid 卡片（按 DOM 顺序 → 波浪顺序）
  if (rankRow) rankRow.querySelectorAll('.stat-card').forEach((c) => gridCards.push(c))
  statCards.forEach((c) => gridCards.push(c))
  let t4 = t3 + 0.9 * 0.7
  gridCards.forEach((card, i) => {
    tl.fromTo(card,
      { opacity: 0, y: 24, filter: 'blur(4px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.85,
        delay: i * 0.07, clearProps: 'filter,transform',
      },
      t4)
  })
  // stat 数字：React StatCard(useCountUp) 自带入场滚动，无需 choreo 干预

  // —— 5. 常用英雄 + 常用武器（loadout 两列，各自标题 + 卡组中心展开） ——
  const lastDelay = Math.max(0, gridCards.length - 1) * 0.07
  let t5 = t4 + 0.85 * 0.7 + lastDelay * 0.7
  loadoutCols.forEach((col, ci) => {
    const titleEl = col.querySelector('.loadout-title')
    const grid = col.querySelector('.card-grid')
    const cards = grid ? Array.from(grid.children).filter((c) => c.classList.contains('hero-card') || c.classList.contains('weapon-card')) : []
    const colBase = t5 + ci * 0.2
    if (titleEl) tl.fromTo(titleEl, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, clearProps: 'transform' }, colBase)
    // 中心展开：delay = |i - (n-1)/2| × 0.12
    const n = cards.length
    cards.forEach((card, i) => {
      const center = (n - 1) / 2
      const dist = i - center
      const d = Math.abs(dist) * 0.12
      const fromX = Math.abs(dist) < 0.001 ? 0 : (dist < 0 ? 1 : -1) * 26
      tl.fromTo(card,
        { opacity: 0, x: fromX, y: 40, scale: 0.96, filter: 'blur(6px)' },
        {
          opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)',
          duration: 0.95, clearProps: 'filter,transform',
        },
        colBase + 0.15 + d)

      // 卡内二级：头像回弹 + 名称上浮 + 使用率淡入 + 进度条填充（入场后同步）
      const avatar = card.querySelector('.hero-card-avatar, .weapon-card-icon')
      const name = card.querySelector('.hero-card-name, .weapon-card-name')
      const usageNum = card.querySelector('.usage-bar-num')
      const fill = card.querySelector('.usage-bar-fill')
      const cardAt = colBase + 0.15 + d
      if (avatar) tl.fromTo(avatar,
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.8)', clearProps: 'transform' },
        cardAt + 0.15)
      if (name) tl.fromTo(name, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, clearProps: 'transform' }, cardAt + 0.2)
      if (usageNum) tl.fromTo(usageNum, { opacity: 0 }, { opacity: 1, duration: 0.5 }, cardAt + 0.26)
      if (fill) {
        const track = fill.closest('.usage-bar-track')
        tl.call(() => {
          if (track) track.classList.add('is-showing')
          // fill 加 usage-entered：CSS transition 从 0 平滑到 --usage-w
          fill.classList.add('usage-entered')
        }, [], cardAt + 0.3)
      }
    })
  })

  return tl
}

/* —— 征神数字排（等级/十殿门/对局/印/成就） —— */
function buildZhengshen(section) {
  const tl = gsap.timeline({ defaults: { ease: EASE } })
  const cn = section.querySelector('.mode-title-cn')
  const en = section.querySelector('.mode-title-en')
  const rule = section.querySelector('.mode-rule')
  const no = section.querySelector('.mode-no')
  const progress = section.querySelector('.zhengshen-progress')
  const progressCards = progress ? Array.from(progress.children).filter((c) => c.classList.contains('zs-progress-card')) : []
  const levelNum = section.querySelector('.zs-big')
  // 数字排 stat-grid：紧随 zhengshen-progress 的那组（对局/印/成就）
  const statGrid = progress?.nextElementSibling?.classList?.contains('stat-grid')
    ? progress.nextElementSibling
    : section.querySelector('.zhengshen-progress + .stat-grid')
  const statCards = statGrid ? Array.from(statGrid.children).filter((c) => c.classList.contains('stat-card')) : []

  let t = 0
  if (no) tl.fromTo(no, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, t)
  const cnChars = cn ? splitTitleChars(cn) : []
  if (cnChars.length) {
    gsap.set(cnChars, { opacity: 0, y: 26, filter: 'blur(8px)' })
    tl.to(cnChars, {
      opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.95,
      stagger: 0.06, clearProps: 'filter',
    }, t)
  }
  if (en) tl.fromTo(en, { opacity: 0, y: 16, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, clearProps: 'filter' }, t + 0.25)
  if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.8, clearProps: 'transform' }, t + 0.35)
  const headDur = 1.0

  // 数字排整排：progress 两块 + stat-grid 三张卡依次上浮 + 数字滚动
  let t2 = t + headDur * 0.7
  progressCards.forEach((card, i) => {
    tl.fromTo(card,
      { opacity: 0, y: 36, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, clearProps: 'filter,transform' },
      t2 + i * 0.15)
  })
  const levelTarget = levelNum ? Number(levelNum.dataset.count) : NaN
  if (!Number.isNaN(levelTarget)) tl.call(() => rollNumber(levelNum, levelTarget), [], t2 + 0.35)

  let t3 = t2 + (progressCards.length - 1) * 0.15 * 0.7 + 1.0
  statCards.forEach((card, i) => {
    tl.fromTo(card,
      { opacity: 0, y: 30, filter: 'blur(5px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.85, clearProps: 'filter,transform' },
      t3 + i * 0.12)
  })
  return tl
}
