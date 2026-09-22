import useCountUp from '../hooks/useCountUp'
import Reveal from './Reveal'

function formatTime(n) {
  const total = Math.max(0, Math.round(Number(n) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * StatCard —— 数据小卡片
 * 数字进入视口时从 0 滚动到目标值（useCountUp，只播一次）。
 * value 为 "—" / null 时静态显示占位符，不参与滚动。
 * format="time" 时按秒数显示 mm:ss。
 */
export default function StatCard({
  label, value, suffix = '', decimals = 0, accent = false, index = 0, countDelay = 200, format,
}) {
  const isPlaceholder = value == null || value === '—' || value === ''
  const numeric = isPlaceholder ? 0 : Number(value)
  const { ref, display } = useCountUp(numeric, { decimals, delayMs: countDelay, comma: format !== 'time' })

  let shown = isPlaceholder ? '—' : display
  if (!isPlaceholder && format === 'time') {
    shown = formatTime(display)
  }

  return (
    <Reveal variant="card" index={index} className={`stat-card${accent ? ' stat-card--accent' : ''}`}>
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value" ref={isPlaceholder ? undefined : ref}>
        {shown}
        {!isPlaceholder && suffix && <em className="stat-card-suffix">{suffix}</em>}
      </span>
    </Reveal>
  )
}
