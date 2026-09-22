import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react'

/* ════════════════════════════════════════════════════════════
 * Dock —— macOS 风格悬浮导航条（纯文字版，零图标依赖）
 * 位置：页面顶部居中（top: 16px）；面板半透明玻璃拟态、面积收小
 * ------------------------------------------------------------
 * 相对"图标方块版 Dock"的三处结构性改造：
 *   1. 尺寸模型：height 由 size 驱动（useSpring 放大动画），width 完全交给内容
 *      （padding: 0 15px + white-space: nowrap）—— 中文项宽窄不一，
 *      不能被正方形模型挤压；fontSize 由【同一个 height motion value】派生
 *      （useTransform，基准 BASE_SIZE 32px → FONT_BASE 12px 线性），放大时文字同步变大
 *   2. 删除 DockLabel 悬浮气泡（文字项自带可见文字，tooltip 冗余），
 *      DockIcon 保留为文字容器
 *   3. 无障碍保留并补齐：menubar/menuitem 角色、tabIndex、aria-label、
 *      Enter（链接原生）/ Space（手动触发点击）、←/→ 移动焦点
 *
 * 行为约定：
 *   - 点击直接复用【现有锚点系统】：渲染 <a href="#xxx">，由 join.js initAnchors 接管
 *     （preventDefault + lenis.scrollTo duration 1.4s / offset -80），不重复实现滚动逻辑
 *   - 当前区块高亮：IntersectionObserver 判定"视口中心所在板块"，
 *     只用 classList.toggle 更新（零 setState、零高频重渲染）
 *   - 磁性放大由 useMotionValue + useTransform 驱动，更新发生在 React 渲染之外
 * ════════════════════════════════════════════════════════════ */

// 锚点沿用现有区块 id（无间镖客实际 id 为 wujian，规格文案里的 #biaoke 在代码中不存在）
const ITEMS = [
  { label: '档案', href: '#profile', id: 'profile' },
  { label: '天选之人', href: '#tianxuan', id: 'tianxuan' },
  { label: '征神之路', href: '#zhengshen', id: 'zhengshen' },
  { label: '无间镖客', href: '#wujian', id: 'wujian' },
  { label: '联系', href: '#contact', id: 'contact' },
]

const SPRING = { mass: 0.1, stiffness: 150, damping: 12 } // 规格默认 spring 配置
const BASE_SIZE = 32        // 基础项高（px）—— 顶部条收小后：40 → 32
const FONT_BASE = 12        // 桌面基础字号（px）—— 32px ↔ 12px 为线性映射基准
const FONT_BASE_TOUCH = 12  // 触屏基础字号（px）—— 5 项在 390px 宽内放得下，不裁切
const MAGNIFICATION = 46    // 悬停放大后的项高（panelHeight 48 之内）
const DISTANCE = 120        // 磁性影响半径（px）
const TOUCH_SIZE = 44       // 触屏项高（触控标准）

/* 单个文字项：宽度自适应、只有高度参与放大 */
function DockItem({ item, mouseX, size, magnification, distance, spring, fontBase, registerItem, onKeyNav }) {
  const ref = useRef(null)

  // 指针与项中心的像素距离（在 motion 的渲染外更新计算，不触发 React 渲染）
  const distanceCalc = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })
  // height：0 距离处放大到 magnification，±distance 之外回到 size
  const heightSync = useTransform(distanceCalc, [-distance, 0, distance], [size, magnification, size])
  const height = useSpring(heightSync, spring)
  // fontSize：由同一个 height 派生（同一个 size motion value）；
  // 静止时恰好等于该模式的基础字号（桌面 32↔12 / 触屏 44↔12），放大时等比变大
  const fontSize = useTransform(height, (h) => (h / size) * fontBase)

  return (
    <motion.a
      ref={(el) => { ref.current = el; registerItem(item.id, el) }}
      href={item.href}
      role="menuitem"
      tabIndex={0}
      aria-label={item.label}
      className="dock-item"
      style={{ height, fontSize }}
      onKeyDown={(e) => {
        // Space 需要手动触发（链接原生只处理 Enter）
        if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); e.currentTarget.click(); return }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onKeyNav(-1, e.currentTarget) }
        if (e.key === 'ArrowRight') { e.preventDefault(); onKeyNav(1, e.currentTarget) }
      }}
    >
      {item.label}
    </motion.a>
  )
}

export default function Dock() {
  const mouseX = useMotionValue(Infinity)          // 指针离开时置 Infinity → 全部回到基础尺寸
  const reduceMotion = useReducedMotion()
  // 触屏（hover:none）：无磁性放大，项高走触控标准
  const isTouch = typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  const size = isTouch ? TOUCH_SIZE : BASE_SIZE
  // reduced-motion：关闭放大（仅保留 hover 高亮），spring 因无差值自然不产生动画
  const magnification = (isTouch || reduceMotion) ? size : MAGNIFICATION

  const itemEls = useRef(new Map())

  /* 高亮更新：直接切 class，绝不 setState（滚动路径零重渲染） */
  const applyActive = (activeId) => {
    itemEls.current.forEach((el, id) => { if (el) el.classList.toggle('is-active', id === activeId) })
  }

  /* 校准：视口中心落在哪个板块，哪个就是"当前区块"（无则全部取消高亮，如首屏 Hero） */
  const calibrate = () => {
    const centerY = window.innerHeight / 2
    let found = null
    for (const id of itemEls.current.keys()) {
      const sec = document.getElementById(id)
      if (!sec) continue
      const r = sec.getBoundingClientRect()
      if (r.top <= centerY && r.bottom > centerY) { found = id; break }
    }
    applyActive(found)
  }

  const registerItem = (id, el) => {
    if (el) itemEls.current.set(id, el)
    else itemEls.current.delete(id)
  }

  // 键盘：←/→ 在项之间移动焦点（menubar 惯例）
  const onKeyNav = (dir, current) => {
    const ids = ITEMS.map((i) => i.id)
    const idx = ids.findIndex((id) => itemEls.current.get(id) === current)
    const next = (idx + dir + ids.length) % ids.length
    itemEls.current.get(ids[next])?.focus()
  }

  useEffect(() => {
    // 1) 入场/落点后立即校准一次（统一启动序列是异步落点，IO 回调不一定覆盖首次落位）
    const raf = requestAnimationFrame(calibrate)
    const onLoad = () => setTimeout(calibrate, 200)   // 字体/落点稳定后再校准
    window.addEventListener('load', onLoad)
    window.addEventListener('hashchange', calibrate)

    // 2) IntersectionObserver：只看视口中心一条窄带，板块穿过即重新判定
    let io = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(() => calibrate(), { rootMargin: '-45% 0px -45% 0px', threshold: 0 })
      ITEMS.forEach(({ id }) => {
        const sec = document.getElementById(id)
        if (sec) io.observe(sec)
      })
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('load', onLoad)
      window.removeEventListener('hashchange', calibrate)
      io?.disconnect()
    }
  }, [])

  return (
    <nav className="dock" data-touch={isTouch ? 'true' : 'false'} aria-label="版块导航">
      <motion.div
        className="dock-panel"
        role="menubar"
        aria-label="版块"
        onMouseMove={(e) => mouseX.set(e.pageX)}   // 渲染外更新 → 不触发 React 渲染
        onMouseLeave={() => mouseX.set(Infinity)}
      >
        {ITEMS.map((item) => (
          <DockItem
            key={item.id}
            item={item}
            mouseX={mouseX}
            size={size}
            magnification={magnification}
            distance={DISTANCE}
            spring={SPRING}
            fontBase={isTouch ? FONT_BASE_TOUCH : FONT_BASE}
            registerItem={registerItem}
            onKeyNav={onKeyNav}
          />
        ))}
      </motion.div>
    </nav>
  )
}
