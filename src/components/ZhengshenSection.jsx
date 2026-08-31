import ModeSection from './ModeSection'
import StatCard from './StatCard'
import { zhengshen } from '../data/stats'

/**
 * 征神之路版块（PVE 刷本）：
 * - 征神等级 / 十殿门层数（1-20）/ 对局数量 / 英雄印数 / 成就数
 * - 常用英雄 + 魂玉搭配卡片
 */

// 十殿门层数进度（1-20）
const SHIDIAN_MAX = 20

export default function ZhengshenSection() {
  const d = zhengshen

  return (
    <ModeSection id="zhengshen" no="03" title="征神之路" en="ZHENSHEN" lead={d.intro}>

      {/* 核心进度：等级 + 十殿门 */}
      <div className="zhengshen-progress">
        <div className="zs-progress-card zs-level">
          <span className="zs-label">征神等级</span>
          <span className="zs-big">{d.level}</span>
        </div>

        <div className="zs-progress-card zs-shidian">
          <div className="zs-shidian-head">
            <span className="zs-label">十殿门 · 层数</span>
            <span className="zs-shidian-num">{d.shidianLayer} / {SHIDIAN_MAX}</span>
          </div>
          {/* 1-20 层格子，已到达亮起 */}
          <div className="zs-shidian-track" role="img" aria-label={`已到第 ${d.shidianLayer} 层`}>
            {Array.from({ length: SHIDIAN_MAX }, (_, i) => (
              <span
                key={i}
                className={`zs-layer${i < d.shidianLayer ? ' is-done' : ''}${i === d.shidianLayer ? ' is-current' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 数量指标 */}
      <div className="stat-grid">
        <StatCard label="对局数量" value={d.matches} />
        <StatCard label="英雄印" value={d.seals} />
        <StatCard label="成就" value={d.achievements} />
      </div>

      {/* 英雄 + 魂玉搭配卡片 */}
      <h4 className="loadout-title">常用英雄 · 魂玉搭配</h4>
      <div className="card-grid card-grid--3">
        {d.heroBuilds.map((hb) => (
          <article key={hb.name} className="build-card">
            <div className="build-card-head">
              <span className="build-card-avatar" aria-hidden="true">{hb.name.slice(0, 1)}</span>
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
          </article>
        ))}
      </div>
    </ModeSection>
  )
}