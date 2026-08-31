import { useEffect, useRef, useState } from 'react'

/**
 * useCountUp —— 数字滚动动画
 * 当元素进入屏幕可见范围时，数字从 0 快速滚动到目标值，只播放一次。
 *
 * 用法：
 *   const { ref, display } = useCountUp(1286)
 *   <span ref={ref}>{display}</span>
 *
 * 支持小数（decimals）和千分位逗号（comma）。
 */
export default function useCountUp(target, { duration = 1400, decimals = 0, comma = true } = {}) {
  const ref = useRef(null)          // 绑定到要观察的元素
  const [display, setDisplay] = useState(0)
  const playedRef = useRef(false)   // 记录是否已播放过，保证只播一次

  // 数字格式化：支持小数（decimals）和千分位逗号（comma）。
  // 放在组件作用域，这样下面的 useEffect 和 return 都能用同一个 format。
  const format = (n) => {
    const fixed = n.toFixed(decimals)
    // 加千分位：把整数部分分组
    const [int, dec] = fixed.split('.')
    const groupedInt = comma ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int
    return dec !== undefined ? `${groupedInt}.${dec}` : groupedInt
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const animate = () => {
      const start = performance.now()
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1)
        // easeOutCubic：先快后慢，更像绩分板
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplay(eased * target)
        if (t < 1) requestAnimationFrame(step)
        else setDisplay(target)
      }
      requestAnimationFrame(step)
    }

    // IntersectionObserver：元素一进入视野就开跑，跑完就断开
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !playedRef.current) {
            playedRef.current = true
            animate()
            observer.disconnect()
          }
        })
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  // 组件加载时先显示一下目标值用于计算宽度（避免抖动），进视野后再滚
  return { ref, display: format(display), raw: display }
}