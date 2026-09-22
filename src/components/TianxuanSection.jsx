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

// 排位指标 14 卡扁平顺序（与截图字段对齐）；"—" 静态占位
const SOLO_METRICS = [
  { key: 'matches',       label: '场次',        suffix: '',   decimals: 0, accent: false },
  { key: 'wins',          label: '天选次数',    suffix: '',   decimals: 0, accent: false },
  { key: 'winRate',       label: '天选率',      suffix: '%',  decimals: 1, accent: false },
  { key: 'top5',          label: '前五数',      suffix: '',   decimals: 0, accent: false },
  { key: 'kills',         label: '击败',        suffix: '',   decimals: 0, accent: false },
  { key: 'avgDamage',     label: '场均伤害',    suffix: '',   decimals: 0, accent: false },
  { key: 'maxKills',      label: '最高击杀',    suffix: '',   decimals: 0, accent: false },
  { key: 'kd',            label: 'KD',          suffix: '',   decimals: 2, accent: false },
  { key: 'maxSurvival',   label: '最长生存',    suffix: '',   decimals: 0, accent: false, format: 'time' },
  { key: 'avgSurvival',   label: '场均生存',    suffix: '',   decimals: 0, accent: false, format: 'time' },
  { key: 'maxMoveDist',   label: '最长移动距离', suffix: '',   decimals: 0, accent: false },
  { key: 'avgMoveDist',   label: '场均移动距离', suffix: '',   decimals: 0, accent: false },
  { key: 'avgRevives',    label: '场均救援',    suffix: '次', decimals: 1, accent: false },
  { key: 'avgHeal',       label: '场均治疗',    suffix: '',   decimals: 0, accent: false }
]

const MODE_TABS = [
  { id: 'solo', label: '单排', rankLabel: '青铜' },
  { id: 'duo',  label: '双排', rankLabel: '无间修罗' },
  { id: 'trio', label: '三排', rankLabel: '无相龙王' }
]

export default function TianxuanSection() {
  return (
    <ModeSection id="tianxuan" no="02" title="天选之人" en="TIANXUAN" lead={tianxuan.intro}>

      <TabGroup
        baseHash="tianxuan"
        defaultId="trio"
        tabs={MODE_TABS.map((m) => ({
          id: m.id,
          label: m.label,
          content: <ModePanel modeId={m.id} />
        }))}
      />

    </ModeSection>
  )
}

// 单个模式的数据面板
function ModePanel({ modeId }) {
  const data = tianxuan.modes[modeId]

  return (
    <div className="mode-panel">
      {/* 历史段位 + 历史积分（积分无数据时隐藏） */}
      <div className="mode-rank-row" data-reveal-group>
        <div className="mode-rank-block">
          <span className="mode-rank-label">历史段位</span>
          <RankBadge rank={data.rank} size="lg" crest={data.rankCrest || null} />
        </div>
        {data.score != null && data.score !== '' && (
          <div className="mode-score-block">
            <StatCard label="历史积分" value={data.score} accent />
          </div>
        )}
      </div>

      {/* 常规指标 14 卡：同一网格语言，层叠错峰入场 */}
      <div className="stat-grid" data-reveal-group>
        {SOLO_METRICS.map((m, i) => (
          <StatCard
            key={m.key}
            label={m.label}
            value={data[m.key]}
            suffix={m.suffix}
            decimals={m.decimals}
            accent={m.accent}
            format={m.format}
            index={i}
          />
        ))}
      </div>

      {/* 常用英雄 + 武器 */}
      <div className="loadout-grid">
        <div className="loadout-col">
          <h4 className="loadout-title" data-reveal="up">常用英雄</h4>
          <div className="card-grid" data-reveal-group>
            {tianxuan.heroes.map((h) => (
              <HeroCard key={h.name} hero={h} usage={h.useByMode[modeId] || 0} />
            ))}
          </div>
        </div>

        <div className="loadout-col">
          <h4 className="loadout-title" data-reveal="up">常用武器</h4>
          <div className="card-grid" data-reveal-group>
            {tianxuan.weapons.map((w) => (
              <WeaponCard key={w.name} weapon={w} usage={w.useByMode[modeId] || 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}