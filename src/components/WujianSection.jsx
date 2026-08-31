import ModeSection from './ModeSection'
import TabGroup from './TabGroup'
import StatCard from './StatCard'
import { wujian } from '../data/stats'

/**
 * 无间镖客版块（PVPVE 摸金撤离）：
 * - Tab 切换 生境 / 险境 / 劫境，各自展示撤离数据
 * - 藏品展示墙（局内带出的稀罕物，稀有度决定边框配色）
 */

// 摸金模式字段：字段名 → 展示名 → 后缀 / 小数位
const EXTRACT_METRICS = [
  { key: 'matches',     label: '场次',             suffix: '',   decimals: 0 },
  { key: 'extractRate', label: '撤离成功率',      suffix: '%',  decimals: 1 },
  { key: 'avgValue',    label: '场均带出价值',    suffix: '古币', decimals: 0 },
  { key: 'maxValue',    label: '最高单局带出',    suffix: '古币', decimals: 0 },
  { key: 'avgSurvival', label: '场均存活时间',    suffix: '分',  decimals: 1 }
]

const MODE_TABS = [
  { id: 'shengjing', label: '生境' },
  { id: 'xianjing',  label: '险境' },
  { id: 'jiejing',   label: '劫境' }
]

// 藏品稀有度配色
const TREASURE_STYLE = {
  legendary: { color: '#f0a020', bg: 'linear-gradient(135deg,#4a3208,#8a5a10)' },
  epic:      { color: '#b060e0', bg: 'linear-gradient(135deg,#2c0f40,#5a1a78)' },
  rare:      { color: '#38a4e8', bg: 'linear-gradient(135deg,#0a2c44,#10548c)' },
  common:    { color: '#9aa5ad', bg: 'linear-gradient(135deg,#1c2124,#3a434a)' }
}

export default function WujianSection() {
  return (
    <ModeSection id="wujian" no="04" title="无间镖客" en="WUJIAN" lead={wujian.intro}>

      <TabGroup baseHash="wujian" tabs={MODE_TABS.map((m) => ({
        id: m.id,
        label: m.label,
        content: <ExtractPanel modeId={m.id} />
      }))} />

      {/* 藏品展示墙 */}
      <div className="treasure-block">
        <h4 className="loadout-title">藏品展示墙</h4>
        <div className="treasure-grid">
          {wujian.treasures.map((t) => {
            const style = TREASURE_STYLE[t.rarity] || TREASURE_STYLE.common
            return (
              <div key={t.name} className="treasure-item" style={{ borderColor: style.color + '66' }}>
                {/* 色块占位："宝物"发光方块 */}
                <span className="treasure-icon" style={{ background: style.bg, boxShadow: `0 0 16px ${style.color}44` }} aria-hidden="true" />
                <div className="treasure-info">
                  <span className="treasure-name">{t.name}</span>
                  <span className="treasure-rarity" style={{ color: style.color }}>
                    {rarityLabel(t.rarity)}
                  </span>
                  <span className="treasure-note">{t.note}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ModeSection>
  )
}

function rarityLabel(r) {
  return { legendary: '传说', epic: '史诗', rare: '稀有', common: '普通' }[r] || r
}

// 单个境况数据面板
function ExtractPanel({ modeId }) {
  const d = wujian.modes[modeId]
  return (
    <div className="mode-panel">
      <div className="stat-grid stat-grid--5">
        {EXTRACT_METRICS.map((m) => (
          <StatCard
            key={m.key}
            label={m.label}
            value={d[m.key]}
            suffix={m.suffix}
            decimals={m.decimals}
          />
        ))}
      </div>
    </div>
  )
}