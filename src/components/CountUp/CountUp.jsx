import { useCallback, useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'

/* ════════════════════════════════════════════════════════════
 * CountUp —— React Bits 官方源码内联（与 MagicBento / AnimatedList 同一接入约定）
 *   来源：https://www.reactbits.dev/text-animations/count-up
 *   原始实现：motion 的 useSpring 驱动数值，spring 收尾带一点回弹，比线性 easeOut 更有「机械计数」的质感。
 *
 *   本地扩展点（两处，均为保持站内既有显示口径所必需）：
 *     ① decimals：固定小数位。官方从数值反推小数位，`2.00` 会被算成 1 位 → 站内 14 卡字段表
 *        明确要求 8.0% / 2.00 / 0.0 这类定长显示，故显式传入。
 *     ② format：自定义格式化。站内「最长生存 / 场均生存」要 mm:ss（官方只输出数字）。
 *   除此之外（duration 与 spring 阻尼/刚度的映射、delay、separator、onStart/onEnd）保持官方行为。
 * ════════════════════════════════════════════════════════════ */
export default function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 1.2,
  className = '',
  startWhen = true,
  separator = '',
  decimals,
  format,
  onStart,
  onEnd,
}) {
  const ref = useRef(null)
  const motionValue = useMotionValue(from)

  // 官方手感：duration 越长 → 阻尼越大、刚度越小（越顺滑）
  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)
  const springValue = useSpring(motionValue, { damping, stiffness })

  const isInView = useInView(ref, { once: true, margin: '0px' })
  const dp = typeof decimals === 'number' ? decimals : 0

  const formatValue = useCallback(
    (latest) => {
      if (typeof format === 'function') return format(latest)
      const text = Intl.NumberFormat('en-US', {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
        useGrouping: !!separator,
      }).format(latest)
      return separator ? text.replace(/,/g, separator) : text
    },
    [dp, separator, format]
  )

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(from)
  }, [from, formatValue])

  useEffect(() => {
    if (!isInView || !startWhen) return
    if (typeof onStart === 'function') onStart()
    const t1 = setTimeout(() => motionValue.set(to), delay * 1000)
    const t2 = setTimeout(() => { if (typeof onEnd === 'function') onEnd() }, delay * 1000 + duration * 1000)
    // 兜底收敛：spring 的尾段很慢（实测大数值 12,374 到 12,373 之后还要几秒才走完最后一位），
    // 到点直接落到精确目标值 —— 卡片上显示的必须等于 stats.js 里的数字，
    // 不能给观众一个永远差两三个数的读数（站内铁律：数据宁缺勿假）。
    const t3 = setTimeout(() => {
      if (typeof springValue.jump === 'function') springValue.jump(to)
      else motionValue.set(to)
    }, delay * 1000 + duration * 1000 + 150)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [isInView, startWhen, motionValue, springValue, to, delay, onStart, onEnd, duration])

  useEffect(() => springValue.on('change', (latest) => {
    if (ref.current) ref.current.textContent = formatValue(latest)
  }), [springValue, formatValue])

  return <span className={className} ref={ref} />
}
