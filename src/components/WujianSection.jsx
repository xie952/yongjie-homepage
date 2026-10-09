import ModeSection from './ModeSection'
import TabGroup from './TabGroup'
import StatCard from './StatCard'
import MagicBento from './MagicBento/MagicBento'
import { wujian, treasureTheme } from '../data/stats'

/**
 * 无间镖客版块（PVPVE 摸金撤离）：
 * - Tab 切换 生境 / 险境 / 劫境，展示【该境自己】的撤离数据
 * - 三境合计：截图只有汇总口径的字段单独成块（不拆成三份相同数字冒充分境数据）
 * - 藏品展示墙（局内带出的稀罕物，稀有度决定边框配色）
 *
 * 数据口径约定（配合 stats.js 的 wujian.totals）：
 *   分境字段 value = null → StatCard 原生显示「—」，即"该境数据未提供"。
 *   汇总字段只读 wujian.totals，绝不落进某个境的面板。
 */

// 分境字段：每个境各一份。null = 该境数据未提供 → 卡片显示「—」（不拿汇总值顶替）
const MODE_METRICS = [
  { key: 'extractRate', label: '撤离成功率',      suffix: '%',  decimals: 1 },
  { key: 'matches',     label: '场次',            suffix: '',   decimals: 0 },
  { key: 'avgValue',    label: '场均带出价值',    suffix: '古币', decimals: 0 },
  { key: 'maxValue',    label: '最高单局带出',    suffix: '古币', decimals: 0 },
  { key: 'avgSurvival', label: '场均存活时间',    suffix: '分',  decimals: 1 }
]

// 汇总字段：截图只给了三境合计口径 → 单独成块，不复制进每个境
const TOTAL_METRICS = [
  { key: 'matches',  label: '三境合计场次',     suffix: '',     decimals: 0 },
  { key: 'avgValue', label: '三境场均带出价值', suffix: '古币', decimals: 0 },
  { key: 'maxValue', label: '三境单局最高带出', suffix: '古币', decimals: 0 }
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

      {/* 三境合计：只承载"截图确实只有汇总口径"的字段。
          totals 不存在（例如将来分境数据齐了、不再需要汇总块）时整块自动消失。 */}
      {wujian.totals && (
        <div className="wujian-totals">
          <h4 className="loadout-title" data-reveal="up">三境合计</h4>
          {/* 三境合计：接入 MagicBento（与天选板块同一套改法）。
              gridClassName="stat-grid" → 列定义沿用站内定义；renderItem 复用既有 <StatCard>；
              data-reveal-group 保留 → 既有入场涟漪照旧生效。
              注：本板块另一处数据卡网格是 .stat-grid stat-grid--5（分境明细，5 卡），
              列定义与天选板块不同，本轮按边界要求**未改动**，见交接文档 §12.3。 */}
          <MagicBento
            items={TOTAL_METRICS}
            gridClassName="stat-grid"
            gridProps={{ 'data-reveal-group': true }}
            renderItem={(m, i) => (
              <StatCard
                key={m.key}
                label={m.label}
                value={wujian.totals[m.key]}
                suffix={m.suffix}
                decimals={m.decimals}
                index={i}
              />
            )}
          />
          <p className="wujian-totals-note" data-reveal="up">
            生境 / 险境 / 劫境 的分境明细待补，先按三境汇总展示。
          </p>
        </div>
      )}

      {/* 藏品展示墙：层叠错峰 */}
      <div className="treasure-block">
        <h4 className="loadout-title" data-reveal="up">藏品展示墙</h4>
        {/* data-reveal-group="fan" = 由中心向两侧入场；藏品 <3 件时中间的卡不动、只淡入上浮 */}
        <div className="treasure-grid" data-reveal-group="fan">
          {wujian.treasures.map((t) => {
            const style = TREASURE_STYLE[t.rarity] || TREASURE_STYLE.common
            return (
              <div
                key={t.name}
                className="treasure-item"
                /* 外框 / 描边光效 / 文字的颜色统一走这条变量链（值引用沈妙英雄卡的 themeColor），
                   与英雄卡 / 武器卡同源，不新增第二套色值。
                   边框色不再内联 —— 静止与 hover 都由 CSS 按 --hero-theme-rgb 控制。 */
                style={{
                  '--hero-theme': treasureTheme.hex,
                  ...(treasureTheme.rgb ? { '--hero-theme-rgb': treasureTheme.rgb } : null),
                }}
              >
                {/* 图标方框：有 imageUrl 用 4K 实图（整图 contain 不裁剪），否则色块占位 */}
                {t.imageUrl ? (
                  <img
                    className="treasure-icon treasure-icon--img"
                    src={t.imageUrl}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                  />
                ) : (
                  <span
                    className="treasure-icon"
                    style={{ background: style.bg, boxShadow: `0 0 16px ${style.color}44` }}
                    aria-hidden="true"
                  />
                )}
                <div className="treasure-info">
                  <span className="treasure-name">{t.name}</span>
                  {/* 标签文案：t.label 优先（纯显示层覆盖，沿用皮肤条目的同一约定）；
                      档位与配色仍跟 rarity 走，文案随便改不影响行为。
                      字色由 CSS 走藏品主题红（本轮之前已覆盖「标签走品质色」的旧策略） */}
                  <span className="treasure-rarity">{t.label || rarityLabel(t.rarity)}</span>
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
      <div className="stat-grid stat-grid--5" data-reveal-group>
        {MODE_METRICS.map((m) => (
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