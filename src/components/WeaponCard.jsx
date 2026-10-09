/**
 * WeaponCard —— 武器卡片
 * 结构同 HeroCard：武器名、当前模式使用率、1-2 个武器皮肤。
 *
 * ── 翻面（P0，2026-09-22 新增）──────────────────────────────
 * 与 HeroCard 同一套实现：点击 → 内层 .card-3d 绕 Y 轴翻转，背面显示该武器在
 * 单/双/三排三模式下的使用率（数据来自 useByMode，正面只显示当前 Tab 那个数）。
 * 旋转落在内层而非卡片本身：卡片 transform 归 fx.js 的 GSAP tilt 所有
 * （quickTo rotationX / rotationY）——写在同一元素上会互相覆盖。
 * .card-3d / .card-face--front 的 preserve-3d 不可删：删了卡内景深分层会被压平。
 */
import { useState } from 'react'
import Reveal from './Reveal'
import { weaponTheme } from '../data/stats'

const RARITY_STYLE = {
  legendary: { label: '传说', color: '#f0a020' },
  epic:      { label: '史诗', color: '#b060e0' },
  rare:      { label: '稀有', color: '#38a4e8' },
  common:    { label: '普通', color: '#9aa5ad' }
}

// 模式 id → 中文标签（与 TianxuanSection 的 MODE_TABS 同文案；那边未导出，此处独立维护一份）
const MODE_LABELS = { solo: '单排', duo: '双排', trio: '三排' }

export default function WeaponCard({ weapon, usage, index = 0 }) {
  // 翻面状态：纯客户端交互态，不参与布局计算
  const [flipped, setFlipped] = useState(false)
  const toggleFlip = () => setFlipped((v) => !v)

  return (
    <Reveal
      as="article"
      variant="card"
      index={index}
      className={`weapon-card${flipped ? ' is-flipped' : ''}`}
      /* 指针点击挂在卡片本身：理由与 HeroCard 逐字相同 —— preserve-3d 场景里
         命中测试按深度排序，铺满卡片的透明按钮抢不过卡内 translateZ 内容 */
      onClick={toggleFlip}
      /* 与英雄卡同名的主题色变量（值来自哈迪那条 themeColor）：
         外框 hover 边框、内层皮肤框、跟随鼠标的 tilt 光晕都读它 → 与英雄卡同色同源 */
      style={{
        '--hero-theme': weaponTheme.hex,
        ...(weaponTheme.rgb ? { '--hero-theme-rgb': weaponTheme.rgb } : null),
      }}
    >
      <div className="card-3d">
        {/* ── 正面：原有用例，逐字未改 ── */}
        <div className="card-face card-face--front">
          <div className="weapon-card-top">
            {/* 武器图标：有 image 用 4K 实图（整图 contain 不裁剪），否则「刃」字占位 */}
            {weapon.image ? (
              <img
                className="weapon-card-icon weapon-card-icon--img"
                src={weapon.image}
                alt=""
                aria-hidden="true"
                decoding="async"
              />
            ) : (
              <span className="weapon-card-icon" aria-hidden="true">刃</span>
            )}
            <div className="weapon-card-head">
              <h4 className="weapon-card-name">{weapon.name}</h4>
              <div className="usage-bar">
                <div className="usage-bar-track">
                  <div className="usage-bar-fill usage-bar-fill--weapon" style={{ '--usage-w': `${usage}%` }} />
                </div>
                <span className="usage-bar-num">{usage}%</span>
              </div>
            </div>
          </div>

          <div className="skin-list">
            {(weapon.skins || []).map((skin) => {
              const style = RARITY_STYLE[skin.rarity] || RARITY_STYLE.common
              return (
                <div
                  key={skin.name}
                  className="skin-item"
                  /* 品质档位以【数据】为准，落到 DOM 上供 fx.js 读取（与 HeroCard 同一约定）：
                     fx.js 用 `item.dataset.rarity || map[标签文案]` 绑定 --rarity-rgb 与 .rarity-breathe。
                     武器卡此前没有这个属性、只能按标签文案查表 —— 一旦把文案改成「极品」，
                     查表必然落空 → 皮肤会丢掉呼吸描边与光晕。补上它，文案就能随便改。
                     边框色仍不内联：由 CSS 按 .weapon-card 的 --hero-theme-rgb 统一驱动 */
                  data-rarity={skin.rarity}
                >
                  {/* 武器皮肤实图：整图 contain 不裁剪；无图用斜切金属条占位 */}
                  {skin.imageUrl ? (
                    <img
                      className="weapon-swatch-img"
                      src={skin.imageUrl}
                      alt=""
                      aria-hidden="true"
                      decoding="async"
                    />
                  ) : (
                    <span className="weapon-swatch" aria-hidden="true">
                      <i style={{ background: weaponSwatch(skin.rarity) }} />
                    </span>
                  )}
                  <div className="skin-info">
                    <span className="skin-name">{skin.name}</span>
                    {/* 标签文案：skin.label 优先（纯显示层覆盖）。
                        字色：labelTheme=true → 读本卡的 --hero-theme（武器卡这份 = weaponTheme = 主题金），
                        与外框/描边同源、**不写死第二份色值**；否则回退品质色。
                        与 HeroCard 的写法逐字一致。 */}
                    <span
                      className="skin-rarity"
                      style={{ color: skin.labelTheme ? 'var(--hero-theme, #d4af58)' : style.color }}
                    >{skin.label || style.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 背面：三模式使用率（数据源 = 同一个 useByMode，不新增字段） ── */}
        <div className="card-face card-face--back">
          <span className="card-back-title">各模式使用率</span>
          <div className="card-back-rows">
            {Object.entries(weapon.useByMode || {}).map(([id, pct]) => (
              <div className="card-back-row" key={id}>
                <span className="card-back-mode">{MODE_LABELS[id] || id}</span>
                <span className="card-back-track">
                  <i style={{ '--usage-w': `${pct}%` }} />
                </span>
                <span className="card-back-pct">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 翻面开关：铺满卡片的透明按钮，放在 .card-3d 之外 → 自身不旋转，翻过去还能点回来 */}
      <button
        type="button"
        className="card-flip-toggle"
        aria-pressed={flipped}
        aria-label={`翻转卡片，查看 ${weapon.name} 在单排/双排/三排的使用率`}
        onClick={toggleFlip}
      />
    </Reveal>
  )
}

function weaponSwatch(rarity) {
  const map = {
    legendary: 'linear-gradient(90deg,#5a3a08,#d8a830,#5a3a08)',
    epic:      'linear-gradient(90deg,#2c0f40,#9a4ac8,#2c0f40)',
    rare:      'linear-gradient(90deg,#0a2c44,#2a90d0,#0a2c44)',
    common:    'linear-gradient(90deg,#23282c,#68747c,#23282c)'
  }
  return map[rarity] || map.common
}
