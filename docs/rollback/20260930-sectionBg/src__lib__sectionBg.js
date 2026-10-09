/**
 * ⚠ 这是 2026-09-30 修复前的旧版（回滚用），不是运行中的代码。
 * 运行中的代码在 src/lib/sectionBg.js。回滚方法见同目录 README.md。
 *
 * sectionBg —— 滚动驱动的「全站背景色」切换
 *
 * 效果：滚过板块时整页底色在 700ms 内平滑换到该板块的主题色（参考 Refero 的整页底色过渡）。
 *
 * 与站内既有体系的关系（重要）：
 *  · 颜色不在这里硬编码。每个板块本来就有 --sec-bg（index.css 里按 #id 指定，取自
 *    --tone-0..3 的明度阶梯）。本模块只是把它原样搬给 :root 的 --section-bg，
 *    由 body { background-color: var(--section-bg); transition: background-color 700ms ease } 完成过渡。
 *    --sec-bg 的取值本身就是 "var(--tone-2)" 这样的 token 串；自定义属性允许再嵌套 var()，
 *    所以这里拿到字符串直接 setProperty 即可 —— 颜色始终只有 CSS token 一处来源，JS 不存任何色值。
 *  · 只读不动滚动：全程只用 IntersectionObserver + 一次同步量算，不碰 Lenis / ScrollTrigger，
 *    不注册滚动监听，因此不可能与入场动画、数字滚动、hover 抢滚动。
 *  · 与轮播区局部光晕完全独立：那套光晕在 .lo-glow-clip 里自己裁切，本模块只改 body 底色（红线 1）。
 *  · 首屏落位不播过渡：避免 hash 直达某个板块时先闪一下 Hero 色再渐变过去。
 *
 * 切换规则：
 *  · 「板块过半」= 该板块覆盖视口 ≥ 50%（板块普遍比视口高，用 intersectionRatio 永远到不了 0.5，
 *    所以用「相交高度 / 视口高度」这个覆盖比例）；
 *  · 多个板块同时过半 → 取覆盖比例更高者；
 *  · 都不足 50% → 回到 Hero 主题色（清掉内联变量，落到 :root 的默认档）。
 *  · 切换后 400ms（移动端 250ms）内不再响应新触发，快速滚动时底色不连闪。
 */

const RATIO_MIN = 0.5
const DEBOUNCE_DESKTOP = 400
const DEBOUNCE_MOBILE = 250
const MOBILE_QUERY = '(max-width: 900px)'

// 板块普遍比视口高，取 0 ~ 1 每 2% 一档，保证每次滚动都有回调进来刷新覆盖比例
const THRESHOLDS = Array.from({ length: 51 }, (_, i) => i / 50)

export default function initSectionBg() {
  const root = document.documentElement
  const sections = Array.from(document.querySelectorAll('.hero, .mode-section, .closing'))
    .filter((el) => el.id && el.closest('main'))
  if (!sections.length) return () => {}

  // 每个板块的目标色：直接读它自己的 --sec-bg（未替换的 token 串，如 "var(--tone-2)"）
  const colorOf = new Map()
  for (const el of sections) colorOf.set(el, getComputedStyle(el).getPropertyValue('--sec-bg').trim())

  const ratio = new Map()
  const mqMobile = window.matchMedia(MOBILE_QUERY)
  let current = null          // 当前生效的板块；null = Hero 兜底
  let lastSwitch = -Infinity
  let enabled = false         // 首屏落位前不播过渡
  let trailing = 0            // 被防抖挡下时挂的尾沿定时器

  const apply = (el) => {
    const v = el ? colorOf.get(el) : ''
    if (v) root.style.setProperty('--section-bg', v)
    else root.style.removeProperty('--section-bg')   // 回落 :root 默认（Hero 档 --tone-0）
  }

  // 取覆盖比例最高且 ≥50% 的板块。用 >= 而不是 > 是有意的：
  // 平局时保留【文档顺序靠后】的那个 —— cover-on 模式下 Hero 被 sticky 钉住、
  // 与 #profile 的覆盖比例会并列 1.0，靠后的 #profile 才是真正盖在最上面的那一层；
  // 普通相邻板块同过半时，靠后的也正是你正在进入的那一段。
  // 这样取舍与滚动方向无关（上滚与下滚在同一点切换），不需要额外的迟滞。
  const pick = () => {
    let best = null
    let bestR = 0
    ratio.forEach((r, el) => { if (r >= RATIO_MIN && r >= bestR) { best = el; bestR = r } })
    return best
  }

  const measure = () => {
    const vh = window.innerHeight || 1
    for (const el of sections) {
      const b = el.getBoundingClientRect()
      const visible = Math.max(0, Math.min(b.bottom, vh) - Math.max(b.top, 0))
      ratio.set(el, Math.min(1, visible / vh))
    }
  }

  const evaluate = () => {
    const best = pick()
    if (best === current) { if (trailing) { window.clearTimeout(trailing); trailing = 0 } return }
    const wait = mqMobile.matches ? DEBOUNCE_MOBILE : DEBOUNCE_DESKTOP
    const elapsed = performance.now() - lastSwitch
    if (enabled && elapsed < wait) {
      // 被防抖挡下时【不能直接丢弃】——丢弃的话，快速滚动结束后底色会永久停在上一段的颜色上
      // （实测：0→5600 连跳后一直停在 Hero 档）。这里改成尾沿补偿：窗口一结束再判一次。
      if (!trailing) trailing = window.setTimeout(() => { trailing = 0; evaluate() }, wait - elapsed + 16)
      return
    }
    if (trailing) { window.clearTimeout(trailing); trailing = 0 }
    current = best
    lastSwitch = performance.now()
    apply(best)
  }

  // ⚠ 选项名必须是 threshold（不是 thresholds）。写成 thresholds 会被当成未知键静默忽略，
  //   阈值退化成默认的 [0] —— 那就只在「相交↔不相交」翻转时回调；
  //   而本页 Hero/档案在初始状态下 isIntersecting 就已经是 true（ratio 0 也算相交），
  //   滚进去时状态不变 → 回调永不触发 → 覆盖比例永远停在初始值。实测踩过一次。
  const io = new IntersectionObserver((entries) => {
    const vh = (entries[0] && entries[0].rootBounds && entries[0].rootBounds.height) || window.innerHeight || 1
    for (const e of entries) ratio.set(e.target, Math.min(1, e.intersectionRect.height / vh))
    evaluate()
  }, { threshold: THRESHOLDS })

  // 同步落一次位：IO 的首个回调是异步的，若等它会先闪 1 帧 Hero 色
  measure()
  current = pick()
  lastSwitch = performance.now()
  root.classList.add('sec-bg-boot')
  apply(current)
  sections.forEach((el) => io.observe(el))
  requestAnimationFrame(() => requestAnimationFrame(() => {
    enabled = true
    root.classList.remove('sec-bg-boot')
  }))

  return () => {
    io.disconnect()
    if (trailing) window.clearTimeout(trailing)
    root.classList.remove('sec-bg-boot')
  }
}
