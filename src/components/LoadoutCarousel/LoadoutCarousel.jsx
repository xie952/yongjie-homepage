import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './LoadoutCarousel.css'

/* ════════════════════════════════════════════════════════════
 * LoadoutCarousel —— 常用英雄 & 武器 合并区块（3D 渐变轮播）
 *   规格来源：单文件原型 public/loadout-carousel.html（已逐项实测通过）
 *   本组件是它的 React 移植：几何参数、主题色、卡片结构、交互完全一致。
 *
 *   规格：7 卡单行 · 居中放大 · 两侧 3D 旋转 + 沿 Z 后退 + 缩小 · 距离>3 隐藏 · 首尾循环
 *     perspective 1600px / origin 50% 46% / maxRotation 26deg / maxDepth 210px / minScale .8
 *     步长 = 卡宽 + 间距 · 桌面 360×392 gap26 / ≤900 314×352 gap18 / ≤560 276×320 gap14
 *     圆角 18 / 内边距 24 / 头像 124(96/84) / 皮肤缩略图 84(72) / 舞台高 = 卡高 + 96
 *     背景 3 径向光斑 blur(28px) saturate(1.15) + 居中卡主题色 700ms 过渡 + 3px 噪点 overlay .35
 *     交互：拖拽>60px 翻页 · 滚轮 320ms 节流 · ←/→ · 圆点 · 箭头 · 循环无死角
 *           点卡切换（2026-09-27 新增）：点左侧可见卡 → 上一张居中，点右侧可见卡 → 下一张居中；
 *           判定为「点击」需 位移 <8px 且按住 <350ms（否则走拖拽逻辑）；居中卡与隐藏卡不响应。
 *
 *   ⚠ 与原型的一处刻意差异（站点环境必需）：滚轮只在【横向手势】时接管翻页，纵向滚轮交还页面。
 *     原型是独立页面、吞掉滚轮无副作用；本站整页可滚动（Lenis），吞纵向滚轮会让鼠标停在本区块时
 *     页面滚不动 —— 站内已两次踩过同一个坑（十殿门列表、魂玉弹窗）。横向手势（触控板左右滑）翻页照常。
 * ════════════════════════════════════════════════════════════ */

const THEMES = {
  hero:   { bg: ['#e8c877', '#e0592b', '#6b4e1f'], accent: '#d8b56a', bright: '#e8c877', deep: '#a98a4a' },
  red:    { bg: ['#e0796a', '#8f2a1f', '#3d1712'], accent: '#c8483a', bright: '#e0796a', deep: '#8f2a1f' },
  weapon: { bg: ['#d8b56a', '#b0642a', '#4d3418'], accent: '#d8b56a', bright: '#e8c877', deep: '#b0642a' }
}

const MAX_ROT = 26        // maxRotationDegrees
const MAX_DEPTH = 210     // maxDepthPx
const MIN_SCALE = 0.8     // minScale
const MAX_DIST = 3        // 距离 >3 隐藏
const DRAG_THRESHOLD = 60
const WHEEL_THROTTLE = 320
// 「点击 vs 拖拽」判定阈值（点卡切换）：位移 < TAP_MOVE 且按住 < TAP_TIME 才算点击
const TAP_MOVE = 8
const TAP_TIME = 350

export default function LoadoutCarousel({ items, modeId }) {
  const n = items.length
  const [active, setActive] = useState(0)

  const stageRef = useRef(null)
  const trackRef = useRef(null)
  const cardRefs = useRef([])
  const blobRefs = useRef([])
  const dragRef = useRef(null)
  const draggedRef = useRef(false)
  const tapRef = useRef(null)   // 按下点 {x, y, t, idx}：供 pointerup 判定「点击 vs 拖拽」，并记住点在哪张卡上
  const wheelRef = useRef(0)
  const tiltRef = useRef({ x: 0, y: 0, drag: 0 })
  const activeRef = useRef(0)   // 供原生 wheel 监听器读取最新 active（避免闭包过期）

  useEffect(() => { activeRef.current = active }, [active])

  const step = useCallback(() => {
    const cs = getComputedStyle(stageRef.current)
    return parseFloat(cs.getPropertyValue('--lo-card-w')) + parseFloat(cs.getPropertyValue('--lo-gap'))
  }, [])

  const applyTrack = useCallback(() => {
    const t = trackRef.current
    if (!t) return
    const { x, y, drag } = tiltRef.current
    t.style.transform = 'rotateX(' + x.toFixed(2) + 'deg) rotateY(' + y.toFixed(2) + 'deg) translateX(' + drag.toFixed(1) + 'px)'
  }, [])

  const layout = useCallback(() => {
    if (!stageRef.current) return
    const s = step()
    cardRefs.current.forEach((el, i) => {
      if (!el) return
      let d = ((i - active) % n + n) % n
      if (d > n / 2) d -= n
      const ad = Math.abs(d)
      const hide = ad > MAX_DIST
      if (el.hidden !== hide) el.hidden = hide
      if (hide) return
      const t = Math.min(ad, MAX_DIST) / MAX_DIST
      const rot = d === 0 ? 0 : -Math.sign(d) * MAX_ROT
      el.style.transform =
        'translate(-50%, -50%) translateX(' + (d * s).toFixed(1) + 'px)' +
        ' translateZ(' + (-MAX_DEPTH * t).toFixed(1) + 'px)' +
        ' rotateY(' + rot.toFixed(2) + 'deg)' +
        ' scale(' + (1 - (1 - MIN_SCALE) * t).toFixed(3) + ')'
      el.style.opacity = (1 - 0.55 * t).toFixed(3)
      el.style.zIndex = String(100 + (MAX_DIST - ad))
      el.classList.toggle('is-active', d === 0)
    })
    // 居中卡主题色 → 三光斑（颜色过渡由 CSS 的 700ms 完成）
    const bg = (THEMES[items[active].theme] || THEMES.hero).bg
    blobRefs.current.forEach((b, i) => { if (b) b.style.color = bg[i] || bg[0] })
  }, [active, n, items, step])

  useEffect(() => { layout() }, [layout, modeId])
  useEffect(() => {
    const on = () => layout()
    window.addEventListener('resize', on)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(on).catch(function () {})
    return () => window.removeEventListener('resize', on)
  }, [layout])

  const setIndex = useCallback((i) => setActive(((i % n) + n) % n), [n])

  /* 点卡切换：向被点中的那一侧走一格（点左侧卡 = 上一张居中，点右侧卡 = 下一张居中）。
     · 居中卡（d === 0）返回原值 → 不切换；它当前没有绑定任何点击行为，若日后要加
       （如翻面看单排/双排/三排数据），在下面的 d === 0 分支里接即可。
     · 隐藏卡（距离 > MAX_DIST，layout 里加了 hidden）不响应。
     · 用函数式 setActive：连点时每次都以最新 active 计算方向，不排动画队列 ——
       CSS transition 会被最后一次目标覆盖，所以「连点不排队、以最后一次为准」。
       注意方向必须在 pointerup 时算，不能在 pointerdown 时算死：
       按下到抬起之间轮播可能已经动过一格。 */
  const tapCard = useCallback((idx) => {
    const el = cardRefs.current[idx]
    if (!el || el.hidden) return
    setActive((cur) => {
      let d = ((idx - cur) % n + n) % n
      if (d > n / 2) d -= n
      if (d === 0) return cur
      return (cur + (d < 0 ? -1 : 1) + n) % n
    })
  }, [n])

  /* ---- 指针：拖拽 >60px 翻页；位移与时长都够小则算点击 → 点卡走一格 ---- */
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // 必须同时存 y：pointerup 的「点击」判定要用 Math.hypot(dx, dy)，
    // 只存 x 会让 dy = clientY - undefined = NaN，NaN < TAP_MOVE 恒为 false → 点击永远不生效。
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    draggedRef.current = false
    // 记住按下点。必须在这里取 target：越过 6px 会 setPointerCapture 到舞台，
    // pointerup 的 target 就变成舞台了，届时分不出点的是哪张卡。
    const cardEl = e.target && e.target.closest ? e.target.closest('.lo-card') : null
    tapRef.current = {
      x: e.clientX, y: e.clientY, t: performance.now(),
      idx: cardEl ? cardRefs.current.indexOf(cardEl) : -1,
    }
    stageRef.current.classList.add('is-dragging')
  }
  const onPointerMove = (e) => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!dragRef.current) {
      if (fine) {
        const r = stageRef.current.getBoundingClientRect()
        tiltRef.current.y = ((e.clientX - r.left) / r.width - 0.5) * 12   // -6 ~ 6
        tiltRef.current.x = -((e.clientY - r.top) / r.height - 0.5) * 8   // -4 ~ 4
        applyTrack()
      }
      return
    }
    const dx = e.clientX - dragRef.current.x
    if (!draggedRef.current && Math.abs(dx) > 6) {
      draggedRef.current = true
      // 越过阈值才捕获指针：早期依赖 click 事件点卡居中时，捕获会让 click 目标重定向到舞台而静默失效
      // （原型实测过）。现在点卡判定改走 pointerdown/up、不再依赖 click，但保留此行为不动。
      try { stageRef.current.setPointerCapture(dragRef.current.id) } catch (err) { /* noop */ }
    }
    if (draggedRef.current) { tiltRef.current.drag = dx * 0.35; applyTrack() }
  }
  const onPointerUp = (e) => {
    if (!dragRef.current) return
    const down = dragRef.current
    const tap = tapRef.current
    const dx = e.clientX - down.x
    const dy = e.clientY - down.y
    // 必须先摘掉 is-dragging：它会让 .lo-card 的 transition 归零
    // （.lo-stage.is-dragging .lo-card { transition: none }），
    // 顺序反了点卡切换会变成瞬移，与箭头切换的 620ms 过渡不一致。
    stageRef.current.classList.remove('is-dragging')
    tiltRef.current.drag = 0
    applyTrack()

    if (draggedRef.current && Math.abs(dx) > DRAG_THRESHOLD) {
      setIndex(active + (dx < 0 ? 1 : -1))   // 拖拽翻页（原逻辑，未改）
    } else if (tap && tap.idx >= 0 && Math.hypot(dx, dy) < TAP_MOVE && performance.now() - tap.t < TAP_TIME) {
      tapCard(tap.idx)                        // 点击侧卡：向该侧走一格
    }

    dragRef.current = null
    tapRef.current = null
    window.setTimeout(() => { draggedRef.current = false }, 0)
  }
  const onPointerCancel = () => {
    dragRef.current = null
    tapRef.current = null
    tiltRef.current.drag = 0
    if (stageRef.current) stageRef.current.classList.remove('is-dragging')
    applyTrack()
  }
  const onPointerLeave = () => {
    if (dragRef.current) return
    tiltRef.current.x = 0
    tiltRef.current.y = 0
    applyTrack()
  }

  /* ---- 滚轮：仅横向手势翻页（纵向交还页面，见文件头注释）；320ms 节流 ----
     ⚠ 必须用原生 addEventListener({ passive: false })：React 的 onWheel 注册在被动监听上，
       preventDefault() 无效，控制台会报 「Unable to preventDefault inside passive event listener」 —— 实测复现过。 */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const onWheelNative = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return   // 纵向手势交还页面（Lenis）
      e.preventDefault()
      const now = Date.now()
      if (now - wheelRef.current < WHEEL_THROTTLE) return     // 320ms 节流
      wheelRef.current = now
      setIndex(activeRef.current + (e.deltaX > 0 ? 1 : -1))
    }
    el.addEventListener('wheel', onWheelNative, { passive: false })
    return () => el.removeEventListener('wheel', onWheelNative)
  }, [setIndex])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(active - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setIndex(active + 1) }
  }

  const cards = useMemo(() => items.map((it, i) => {
    const th = THEMES[it.theme] || THEMES.hero
    const usage = (it.usageByMode && it.usageByMode[modeId]) || 0
    return { it, i, th, usage }
  }), [items, modeId])

  return (
    <section className="lo-block" aria-roledescription="carousel" aria-label="常用英雄与武器">
      <header className="lo-head">
        <h3 className="lo-title">常用英雄 &amp; 武器</h3>
        <div className="lo-legend">
          <span className="lo-legend-item"><i className="lo-dot lo-dot--hero" />英雄 ×3</span>
          <span className="lo-legend-item"><i className="lo-dot lo-dot--weapon" />武器 ×4</span>
        </div>
      </header>

      <div
        className="lo-stage"
        ref={stageRef}
        tabIndex={0}
        role="group"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        {/* 背景光晕：必须由这个 absolute + inset:0 + overflow:hidden 的局部层裁切在本区块内。
            实测教训：只靠 .lo-stage 的 overflow:hidden 不够 —— 舞台里有 preserve-3d 子树时，
            带 filter:blur() 的光晕层会逃出裁剪，在「天选之人」数据卡区形成一条竖直金色光柱。
            因此：① 单独加裁切层 + contain:paint；② 完全不用 filter:blur，柔和度交给 radial-gradient 自身。 */}
        <div className="lo-glow-clip" aria-hidden="true">
          <div className="lo-ambient">
            <span className="lo-blob lo-blob--a" ref={(el) => { blobRefs.current[0] = el }} />
            <span className="lo-blob lo-blob--b" ref={(el) => { blobRefs.current[1] = el }} />
            <span className="lo-blob lo-blob--c" ref={(el) => { blobRefs.current[2] = el }} />
          </div>
          <span className="lo-grain" />
        </div>

        <div className="lo-track" ref={trackRef}>
          {cards.map(({ it, i, th, usage }) => (
            <article
              key={it.name}
              ref={(el) => { cardRefs.current[i] = el }}
              className={'lo-card' + (active === i ? ' is-active' : '')}
              data-theme={it.theme}
              aria-label={it.kind + ' ' + it.name + '，使用率 ' + usage + '%'}
              style={{ '--lo-accent': th.accent, '--lo-bright': th.bright, '--lo-deep': th.deep }}
            >
              <span className="lo-badge">{it.kind}</span>
              <div className="lo-persona">
                {/* 头像：用项目既有图片（英雄 = stats.js 的 hero.avatar；武器 = weapon.image），不走占位块 */}
                <span className="lo-avatar">
                  <img className="lo-avatar-img" src={it.portrait} alt={it.name} draggable={false} decoding="async" />
                </span>
                <h4 className="lo-name">{it.name}</h4>
              </div>
              <div className="lo-usage">
                <div className="lo-usage-head"><span>使用率</span><b>{usage}%</b></div>
                <div className="lo-bar"><i style={{ width: usage + '%' }} /></div>
              </div>
              <div className="lo-foot">
                <span className="lo-idx">{String(i + 1).padStart(2, '0')}</span>
                <div className="lo-skin">
                  {/* 皮肤缩略图：用项目既有图片（stats.js 的 skins[0].imageUrl） */}
                  <span className="lo-thumb">
                    <img className="lo-thumb-img" src={it.skin.image} alt={it.skin.name} draggable={false} decoding="async" />
                  </span>
                  <div className="lo-skin-meta">
                    <span className="lo-skin-name">{it.skin.name}</span>
                    <span className="lo-grade">{it.skin.grade}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="lo-controls">
        <button className="lo-arrow" type="button" aria-label="上一张" onClick={() => setIndex(active - 1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="lo-dots" role="tablist" aria-label="卡片导航">
          {items.map((it, i) => (
            <button
              key={it.name}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={'第 ' + (i + 1) + ' 张：' + it.name}
              className={active === i ? 'is-active' : ''}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
        <button className="lo-arrow" type="button" aria-label="下一张" onClick={() => setIndex(active + 1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </section>
  )
}
