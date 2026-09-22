import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

/* ════════════════════════════════════════════════════════════
 * MagneticButton —— 磁性悬浮按钮（距离衰减吸引）
 * ------------------------------------------------------------
 * 三处相对源码的关键改造：
 *   1. 【渲染外更新】不用 useState 存位移：x/y 是 useMotionValue，
 *      指针事件里只 x.set()/y.set() → 零 React 重渲染
 *      （全站纪律：指针/滚动路径禁 setState）
 *   2. 【无调试视觉】没有蓝色虚线框、没有 hasMoved 变色、没有 --show-color，
 *      外层容器纯透明，只负责承载 transform 与接收指针事件
 *   3. 【距离衰减吸引力】不再用 maxDistance + clamp：
 *        dist < R 时 f = strength × (1 − dist / R)
 *        位移目标 = (指针 − 中心) × f
 *      越近吸得越强、到感应圈边缘平滑归零（无 clamp 跳变）；
 *      dist ≥ R 或指针离开感应场 → 目标归零，弹簧自然回中
 *
 * 分层（防 transform 打架，与 Hero 既有动画并行）：
 *   外层 = 调用方容器（Hero 的 .hero-actions）→ 承接入场 fade-up / 滚动穿透淡出
 *   中层 = .magnetic-mover（本组件）→ 只写磁性 translate
 *   内层 = 按钮本体 → 自己的 hover:translateY(-1px) / ripple 不受影响
 *
 * 参数全部可调（props）：strength / radius / spring
 * ════════════════════════════════════════════════════════════ */

const DEFAULT_SPRING = { stiffness: 120, damping: 16, mass: 0.1 }

export default function MagneticButton({
  children,
  strength = 0.7,              // 吸引强度系数（0.7 = 指针在按钮中心附近时最多吸 0.7×距离）
  radius = 120,                // 感应半径 R（px）
  spring = DEFAULT_SPRING,     // 软弹簧 + 明显回弹
  fieldSelector = null,        // 指针事件场（如 '#top'）；不传则只监听组件自身范围
  className = '',
}) {
  const wrapRef = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, spring)
  const sy = useSpring(y, spring)

  // 环境降级（只判定一次，不参与渲染循环）：
  //   触屏无 hover（hover:none）→ 磁性禁用，按钮静止可点击
  //   prefers-reduced-motion → 磁性禁用，弹簧不运行
  const enabledRef = useRef(null)
  if (enabledRef.current === null) {
    const fine = typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    enabledRef.current = fine && !reduce
  }
  const enabled = enabledRef.current

  useEffect(() => {
    if (!enabled) return undefined
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const field = fieldSelector ? document.querySelector(fieldSelector) : null
    const targets = [wrap, field].filter(Boolean)

    // 指针处理：零分配、零 setState —— 只写 motion value（渲染外更新）
    const onMove = (e) => {
      const r = wrap.getBoundingClientRect()      // 用未被位移的 wrapper 求中心，避免自反馈振荡
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist >= radius) {
        x.set(0); y.set(0)                        // 出感应圈：目标归零，弹簧回中
        return
      }
      const f = strength * (1 - dist / radius)    // 距离衰减：越近越强，边缘平滑归零
      x.set(dx * f)
      y.set(dy * f)
    }
    const onLeave = () => { x.set(0); y.set(0) }  // 离开感应场（含离开 Hero）：回中

    targets.forEach((t) => {
      t.addEventListener('pointermove', onMove, { passive: true })
      t.addEventListener('pointerleave', onLeave, { passive: true })
    })
    return () => {
      targets.forEach((t) => {
        t.removeEventListener('pointermove', onMove)
        t.removeEventListener('pointerleave', onLeave)
      })
    }
    // enabled / fieldSelector 恒定，不会重复绑定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fieldSelector])

  return (
    <div
      className={'magnetic ' + className}
      ref={wrapRef}
      style={{ '--mag-radius': radius + 'px' }}
    >
      <motion.div className="magnetic-mover" style={{ x: sx, y: sy }}>
        {children}
      </motion.div>
    </div>
  )
}
