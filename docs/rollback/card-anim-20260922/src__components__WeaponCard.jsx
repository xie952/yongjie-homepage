/**
 * WeaponCard —— 武器卡片
 * 结构同 HeroCard：武器名、当前模式使用率、1-2 个武器皮肤。
 */
import Reveal from './Reveal'
import { weaponTheme } from '../data/stats'

const RARITY_STYLE = {
  legendary: { label: '传说', color: '#f0a020' },
  epic:      { label: '史诗', color: '#b060e0' },
  rare:      { label: '稀有', color: '#38a4e8' },
  common:    { label: '普通', color: '#9aa5ad' }
}

export default function WeaponCard({ weapon, usage, index = 0 }) {
  return (
    <Reveal
      as="article"
      variant="card"
      index={index}
      className="weapon-card"
      /* 与英雄卡同名的主题色变量（值来自哈迪那条 themeColor）：
         外框 hover 边框、内层皮肤框、跟随鼠标的 tilt 光晕都读它 → 与英雄卡同色同源 */
      style={{
        '--hero-theme': weaponTheme.hex,
        ...(weaponTheme.rgb ? { '--hero-theme-rgb': weaponTheme.rgb } : null),
      }}
    >
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