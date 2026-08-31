import useCountUp from '../hooks/useCountUp'

/**
 * StatCard —— 数据小卡片
 * 显示一个指标名称 + 数值，数字进入视野时从 0 滚动到目标值，只播一次。
 *
 * 用法：
 *   <StatCard label="场均伤害" value={12680} />
 *   <StatCard label="胜率" value={11.4} suffix="%" decimals={1} />
 *   <StatCard label="KD" value={2.36} decimals={2} />
 */
export default function StatCard({ label, value, suffix = '', decimals = 0, accent = false }) {
  const { ref, display } = useCountUp(value, { decimals })

  return (
    <div className={`stat-card${accent ? ' stat-card--accent' : ''}`}>
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value" ref={ref}>
        {display}
        {suffix && <em className="stat-card-suffix">{suffix}</em>}
      </span>
    </div>
  )
}