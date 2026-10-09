import ModeSection from './ModeSection'
import TabGroup from './TabGroup'
import StatCard from './StatCard'
import MagicBento from './MagicBento/MagicBento'
import RankBadge from './RankBadge'
import LoadoutCarousel from './LoadoutCarousel/LoadoutCarousel'
import { tianxuan } from '../data/stats'

/* 合并区块的 7 张卡：英雄 3 + 武器 4（顺序即 01~07）。
   主题判定：沈妙 → red，其余英雄 → hero 金，武器 → weapon 金铜；
   皮肤名与品级取 stats.js 既有字段（name / label），使用率随 Tab 走 useByMode。 */
const LOADOUT_ITEMS = [
  ...tianxuan.heroes.map((h) => ({
    kind: '英雄',
    theme: h.name === '沈妙' ? 'red' : 'hero',
    name: h.name,
    usageByMode: h.useByMode,
    portrait: h.avatar,                                  // 既有头像图：/hero-avatar-hadi.png 等
    skin: { name: h.skins[0].name, grade: h.skins[0].label || '极品', image: h.skins[0].imageUrl },  // 既有皮肤图
  })),
  ...tianxuan.weapons.map((w) => ({
    kind: '武器',
    theme: 'weapon',
    name: w.name,
    usageByMode: w.useByMode,
    portrait: w.image,                                   // 既有武器图标：/Quanren.PNG 等
    skin: { name: w.skins[0].name, grade: w.skins[0].label || '极品', image: w.skins[0].imageUrl },
  })),
]

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

      {/* 常规指标 14 卡：同一网格语言，层叠错峰入场。
          卡片容器交给 MagicBento（React Bits）：全局聚光 + 邻近卡泛金光 + 点击金色涟漪。
          · items 就是既有的 SOLO_METRICS —— 数据源 / 数值 / 数字滚动一律不动
          · gridClassName="stat-grid" → 列定义、间距、margin 全部沿用现有数据卡网格，
            不使用组件默认的 4 栏 / 0.5em gap / 0.75em padding
          · renderItem 直接复用既有 <StatCard>（左上角切角 + 指标名 + 金色数值 + 数字滚动），
            不使用组件默认的 header(label) + content(title, desc) 结构
          · data-reveal-group 保留 → 既有入场涟漪照旧生效，与 MagicBento 效果叠加 */}
      <MagicBento
        items={SOLO_METRICS}
        gridClassName="stat-grid"
        gridProps={{ 'data-reveal-group': true }}
        renderItem={(m, i) => (
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
        )}
      />

      {/* 常用英雄 & 武器：合并为单一区块（7 卡单行 3D 渐变轮播）
          规格与单文件原型 public/loadout-carousel.html 一致；使用率随当前 Tab（单/双/三排）联动。
          逐卡主题色：英雄金 / 沈妙红 / 武器金铜，由组件内的 THEMES 表给出，取 stats.js 的 kind 判定。 */}
      <LoadoutCarousel items={LOADOUT_ITEMS} modeId={modeId} />
    </div>
  )
}