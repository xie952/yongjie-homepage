import { useCallback, useMemo, useRef, useState } from 'react'
import ModeSection from './ModeSection'
import AnimatedList from './AnimatedList/AnimatedList'
import StatCard from './StatCard'
import BuildDetailModal from './BuildDetailModal'
import { zhengshen } from '../data/stats'

/**
 * 征神之路版块（PVE 刷本）：
 * - 征神等级 / 十殿门层级列表（纵向可滚，历史最高口径）/ 对局数量 / 英雄印数 / 成就数
 * - 常用英雄 + 魂玉搭配卡片
 */

// 十殿门满层数：辅读数「/ 20」与终点行序号都以它为准
// （全站口径为历史最高，不写当前赛季分 / 实时分）
const SHIDIAN_MAX = 20

// 十殿门段位顺序：每段位 2 层；终点「神伐」单独成行，读数取 zhengshen.shidianLayer
const SHIDIAN_TIERS = ['青铜', '白银', '黄金', '铂金', '陨星', '蚀月', '坠日']
const SHIDIAN_LAYERS_PER_TIER = 2

// 常量数组 → 行数据：[{ name:'青铜', idx:'01' }, { name:'青铜', idx:'02' }, …]
const SHIDIAN_ROWS = SHIDIAN_TIERS.flatMap((name) =>
  Array.from({ length: SHIDIAN_LAYERS_PER_TIER }, (_, i) => ({
    name,
    idx: String(i + 1).padStart(2, '0'),
  }))
)

export default function ZhengshenSection() {
  const d = zhengshen
  const stage = d.shidianStage || '神伐'
  const layer = d.shidianLayer

  // 十殿门列表数据：段位行（青铜01 … 坠日02）+ 终点行（神伐 / 历史最高 / 层数）。
  // 数据源就是本文件模块级的 SHIDIAN_TIERS / SHIDIAN_LAYERS_PER_TIER —— 本站**没有**把段位表
  // 放进 stats.js（那里只有 zhengshen.shidianStage / shidianLayer 两个读数），所以就地派生。
  // 列表组件不硬编码任何一行，行数增减只改上面的常量。
  const shidianItems = useMemo(
    () => [...SHIDIAN_ROWS, { name: stage, idx: layer, final: true }],
    [stage, layer]
  )

  // 详情弹窗：纯内存态，**不写 hash**（站内 hash 要留给版块定位，写进去会复发定位时序 bug）
  const [detail, setDetail] = useState(null)
  const returnFocusRef = useRef(null)   // 触发卡片，关闭时把焦点还回去
  const closeDetail = useCallback(() => setDetail(null), [])
  const openDetail = useCallback((hb, el) => {
    returnFocusRef.current = el
    setDetail(hb)
  }, [])

  return (
    <ModeSection id="zhengshen" no="03" title="征神之路" en="ZHENSHEN" lead={d.intro}>

      {/* 核心进度：等级 + 十殿门（作为卡片组层叠入场） */}
      <div className="zhengshen-progress" data-reveal-group>
        <div className="zs-progress-card zs-level">
          <span className="zs-label">征神等级</span>
          <span className="zs-big" data-count={d.level}>{d.level}</span>
        </div>

        <div className="zs-progress-card zs-shidian">
          <div className="zs-shidian-head">
            <span className="zs-label">十殿门 / 历史最高</span>
            <span className="zs-shidian-num">
              <span className="zs-shidian-stage">{stage} {layer}</span>
              <span className="zs-shidian-sub">/ {SHIDIAN_MAX}</span>
            </span>
          </div>

          {/* 层级列表：纵向可滚。视口约 4 整行 + 第 5 行露约 40%，本身就是可滑暗示。
              终点行是全程唯一的强调行（金色）；文案固定「历史最高」——口径是历史最高，
              不写当前赛季分 / 实时分。

              逐行入场交给 React Bits 的 AnimatedList（见 components/AnimatedList/）：
              每行进入视口 50% 时从 scale .7 + opacity 0 浮现，delay = 0.06 × 行号，
              滚出视口回退、滚回来重播。它替代了原先「列表内不叠第二套动画」的做法 ——
              现在这一列表有自己的逐行节奏，卡片本身的入场编排不受影响。

              data-lenis-prevent 仍然必须：本项目全局启了 Lenis 平滑滚动（smoothWheel: true），
              Lenis 的滚轮处理只有碰到这个属性才会提前 return 放行原生滚动（lenis.mjs:609-612）；
              否则它会 event.preventDefault() 把滚轮全部吃掉去滚整页 —— 这个内层列表就永远滚不动。
              下面通过 scrollProps 落到 AnimatedList 真正的滚动容器 .scroll-list 上。
              tabIndex 同理：可滚区域必须键盘可达（读屏/键盘用户否则到不了这段内容）；
              本站关掉了组件的键盘导航，靠的就是这个原生可聚焦容器 + 原生方向键滚动。 */}
          <AnimatedList
            items={shidianItems}
            /* 段位行目前无点击行为：不接弹窗，保留接口 */
            onItemSelect={undefined}
            /* 上下渐隐是本效果的核心，保留 */
            showGradients
            /* 关闭：组件把 keydown 绑在 window 上，会劫持全页 ↑↓ / Tab / Enter，
               与 hash 定位及后续可能的键盘交互冲突 */
            enableArrowNavigation={false}
            displayScrollbar
            /* 逐行浮现：第 i 行延迟 0.06s（组件默认固定 0.1s） */
            itemDelay={0.06}
            className="zs-shidian-anim"
            scrollClassName="zs-shidian-list"
            scrollProps={{
              tabIndex: 0,
              role: 'list',
              'data-lenis-prevent': true,
              'aria-label': '十殿门历史最高层级列表',
            }}
            /* 每行外面还有一层组件的包装元素，list 语义要挂在它上面才成立 */
            itemWrapperProps={{ role: 'listitem' }}
            renderItem={(row, index, { selected }) => (
              <div
                className={
                  'zs-shidian-row'
                  + (row.final ? ' zs-shidian-row--final' : '')
                  + (selected ? ' is-hover' : '')
                }
              >
                <span className="zs-shidian-name">{row.name}</span>
                {row.final && <span className="zs-shidian-badge">历史最高</span>}
                <span className="zs-shidian-idx">{row.idx}</span>
              </div>
            )}
          />
        </div>
      </div>

      {/* 数量指标：层叠错峰 */}
      <div className="stat-grid" data-reveal-group>
        <StatCard label="对局数量" value={d.matches} />
        <StatCard label="英雄印" value={d.seals} />
        <StatCard label="成就" value={d.achievements} />
      </div>

      {/* 英雄 + 魂玉搭配卡片 */}
      <h4 className="loadout-title" data-reveal="up">常用英雄 · 魂玉搭配</h4>
      {/* data-reveal-group="fan" = 由中心向两侧入场；条数变化自动适配（0/1/2 张都有定义） */}
      <div className="card-grid card-grid--3" data-reveal-group="fan">
        {d.heroBuilds.map((hb) => (
          <article
            key={hb.name}
            className="build-card build-card--clickable"
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={`查看 ${hb.name} · ${hb.build} 详情图`}
            onClick={(e) => openDetail(hb, e.currentTarget)}
            onKeyDown={(e) => {
              // role="button" 需要自己补齐键盘等价操作
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(hb, e.currentTarget) }
            }}
          >
            <div className="build-card-head">
              {hb.avatar ? (
                <img
                  className="build-card-avatar build-card-avatar--img"
                  src={hb.avatar}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                />
              ) : (
                <span className="build-card-avatar" aria-hidden="true">{hb.name.slice(0, 1)}</span>
              )}
              <div>
                <h4 className="build-card-name">{hb.name}</h4>
                <span className="build-card-flow">{hb.build}</span>
              </div>
            </div>
            <div className="jade-row">
              {hb.jades.map((j) => (
                <span key={j} className="jade-chip">{j}</span>
              ))}
            </div>
            <p className="build-card-note">{hb.note}</p>
            {/* 右下角微提示：低透明度小字，只在 hover / 键盘聚焦时浮现，不与既有光效冲突 */}
            <span className="build-card-hint" aria-hidden="true">查看详情</span>
          </article>
        ))}
      </div>

      {/* 详情弹窗常驻挂载（内部用 is-open 切类做进出场），组件自己 portal 到 body */}
      <BuildDetailModal build={detail} onClose={closeDetail} returnFocusRef={returnFocusRef} />
    </ModeSection>
  )
}