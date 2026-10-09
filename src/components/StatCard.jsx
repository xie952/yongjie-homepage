import CountUp from './CountUp/CountUp'
import Reveal from './Reveal'

function formatTime(n) {
  const total = Math.max(0, Math.round(Number(n) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * StatCard —— 数据小卡片
 * 数字进入视口后由 React Bits CountUp 滚到目标值（只播一次，spring 手感）。
 * value 为 null / "—" 时静态显示占位符，不参与滚动。
 * format="time" 时按秒数显示 mm:ss（走 CountUp 的 format 扩展点，恒定两位秒数）。
 *
 * 数字的启动时刻 = 进入视口后 countDelay(默认 600ms，卡片入场约 0.95s) + 按卡序逐张延后 60ms，
 * 与 choreo 的错峰节奏对齐 —— 避免「数字先跳、卡片后到」。
 */
export default function StatCard({
  label, value, suffix = '', decimals = 0, accent = false, index = 0, countDelay = 600, format,
}) {
  const isPlaceholder = value == null || value === '—' || value === ''
  const numeric = isPlaceholder ? 0 : Number(value)
  const isTime = !isPlaceholder && format === 'time'

  return (
    <Reveal variant="card" index={index} className={`stat-card${accent ? ' stat-card--accent' : ''}`}>
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">
        {isPlaceholder ? '—' : (
          <CountUp
            to={numeric}
            duration={1.3}
            delay={(countDelay + index * 60) / 1000}
            decimals={isTime ? 0 : decimals}
            separator={isTime ? '' : ','}
            format={isTime ? formatTime : undefined}
          />
        )}
        {!isPlaceholder && suffix && <em className="stat-card-suffix">{suffix}</em>}
      </span>
    </Reveal>
  )
}
