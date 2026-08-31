import ModeSection from './ModeSection'
import TabGroup from './TabGroup'
import StatCard from './StatCard'
import RankBadge from './RankBadge'
import HeroCard from './HeroCard'
import WeaponCard from './WeaponCard'
import { tianxuan } from '../data/stats'

/**
 * 天选之人版块：
 * - Tab 切换 单排 / 双排 / 三排，各自展示排位数据
 * - 常用英雄卡片（使用率随当前 Tab 联动）
 * - 常用武器卡片
 */

// 排位指标统一顺序：字段名 → 展示名 → 是否带百分号/小数
const SOLO_METRICS = [
  { key: 'matches',    label: '场次',        suffix: '',   decimals: 0, accent: false },
  { key: 'winRate',    label: '胜率',        suffix: '%',  decimals: 1, accent: false },
  { key: 'avgDamage',  label: '场均伤害',    suffix: '',   decimals: 0, accent: false },
  { key: 'maxKills',   label: '最高击杀',    suffix: '',   decimals: 0, accent: false },
  { key: 'kd',         label: 'KD',          suffix: '',   decimals: 2, accent: false },
  { key: 'avgRevives', label: '场均救援',    suffix: '次', decimals: 1, accent: false },
  { key: 'avgHeal',    label: '场均治疗',    suffix: '',   decimals: 0, accent: false }
]

const MODE_TABS = [
  { id: 'solo', label: '单排' },
  { id: 'duo',  label: '双排' },
  { id: 'trio', label: '三排' }
]

export default function TianxuanSection() {
  return (
    <ModeSection id="tianxuan" no="02" title="天选之人" en="TIANXUAN" lead={tianxuan.intro}>

      <TabGroup baseHash="tianxuan" tabs={MODE_TABS.map((m) => ({
        id: m.id,
        label: m.label,
        content: <ModePanel modeId={m.id} />
      }))} />

    </ModeSection>
  )
}

// 单个模式的数据面板
function ModePanel({ modeId }) {
  const data = tianxuan.modes[modeId]

  return (
    <div className="mode-panel">
      {/* 段位 + 积分（突出显示） */}
      <div className="mode-rank-row">
        <div className="mode-rank-block">
          <span className="mode-rank-label">当前段位</span>
          <RankBadge rank={data.rank} size="lg" />
        </div>
        <div className="mode-score-block">
          <StatCard label="当前积分" value={data.score} accent />
        </div>
      </div>

      {/* 常规指标网格 */}
      <div className="stat-grid">
        {SOLO_METRICS.map((m) => (
          <StatCard
            key={m.key}
            label={m.label}
            value={data[m.key]}
            suffix={m.suffix}
            decimals={m.decimals}
            accent={m.accent}
          />
        ))}
      </div>

      {/* 常用英雄 + 武器 */}
      <div className="loadout-grid">
        <div className="loadout-col">
          <h4 className="loadout-title">常用英雄</h4>
          <div className="card-grid">
            {tianxuan.heroes.map((h) => (
              <HeroCard key={h.name} hero={h} usage={h.useByMode[modeId] || 0} />
            ))}
          </div>
        </div>

        <div className="loadout-col">
          <h4 className="loadout-title">常用武器</h4>
          <div className="card-grid">
            {tianxuan.weapons.map((w) => (
              <WeaponCard key={w.name} weapon={w} usage={w.useByMode[modeId] || 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}