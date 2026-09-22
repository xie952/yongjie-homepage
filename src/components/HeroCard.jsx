/**
 * HeroCard —— 英雄卡片
 * 展示：英雄名、当前模式使用率、1-2 个常用皮肤（皮肤名 + 外观占位色块）
 * 皮肤根据 rarity 稀有度显示不同颜色的边框/标签。
 */
import Reveal from './Reveal'

// 稀有度 → 标签文案 + 配色
const RARITY_STYLE = {
  legendary: { label: '传说', color: '#f0a020', bg: 'rgba(240,160,32,.14)' },
  epic:      { label: '史诗', color: '#b060e0', bg: 'rgba(176,96,224,.14)' },
  rare:      { label: '稀有', color: '#38a4e8', bg: 'rgba(56,164,232,.14)' },
  common:    { label: '普通', color: '#9aa5ad', bg: 'rgba(154,165,173,.12)' }
}

export default function HeroCard({ hero, usage, index = 0 }) {
  // 英雄主题色 → CSS 变量：--hero-theme（hex，给进度条渐变用）
  //                     --hero-theme-rgb（r, g, b 三元组，配 rgba 透明度做边框/光晕）
  // 与排位模式无关：切 Tab 只改 usage，变量不变
  const themeRgb = hexToRgbTriple(hero.themeColor)
  return (
    <Reveal
      as="article"
      variant="card"
      index={index}
      className="hero-card"
      style={{
        '--hero-theme': hero.themeColor,
        ...(themeRgb ? { '--hero-theme-rgb': themeRgb } : null),
      }}
    >
      <div className="hero-card-top">
        {/* 英雄头像：有 avatar 图用图，否则渐变色块 + 首字 */}
        {hero.avatar ? (
          <img className="hero-card-avatar hero-card-avatar--img" src={hero.avatar} alt="" aria-hidden="true" />
        ) : (
          <span className="hero-card-avatar" aria-hidden="true">
            {hero.name.slice(0, 1)}
          </span>
        )}
        <div className="hero-card-head">
          <h4 className="hero-card-name">{hero.name}</h4>
          {/* 使用率进度条 */}
          <div className="usage-bar">
            <div className="usage-bar-track">
              <div className="usage-bar-fill" style={{ '--usage-w': `${usage}%` }} />
            </div>
            <span className="usage-bar-num">{usage}%</span>
          </div>
        </div>
      </div>

      {/* 皮肤列表 */}
      <div className="skin-list">
        {(hero.skins || []).map((skin) => {
          const style = RARITY_STYLE[skin.rarity] || RARITY_STYLE.common
          return (
            <div
              key={skin.name}
              className="skin-item"
              /* 稀有度同时以数据形式落到 DOM：呼吸光晕/描边的绑定读它，
                 这样标签文案可以自由改写（如「极品」）而不影响行为 */
              data-rarity={skin.rarity}
              /* 底色与边框色都不在此内联：统一由 CSS 按 .hero-card 的 --hero-theme-rgb 控制
                 （内层框的底色/描边/光晕全部跟随英雄主题色，与外框同源）。
                 品质色只保留给下面的「传说/史诗/稀有」标签。 */
            >
              {/* 皮肤图：完整图 contain 不裁剪；无图则色块占位 */}
              {skin.imageUrl ? (
                <img
                  className="skin-swatch skin-swatch--img"
                  src={skin.imageUrl}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                />
              ) : (
                <span
                  className="skin-swatch"
                  aria-hidden="true"
                  style={{ background: `linear-gradient(135deg, ${swatchColor(skin.rarity, 0)} , ${swatchColor(skin.rarity, 1)})` }}
                />
              )}
              <div className="skin-info">
                <span className="skin-name">{skin.name}</span>
                {/* 标签文案：skin.label 优先（纯显示层覆盖）；字色默认取品质色，
                    labelTheme=true 时改为读本卡的 --hero-theme（与外框同源，改主题色只改一处） */}
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

// 主题色 hex → "r, g, b" 三元组（CSS 变量配 rgba() 使用）；解析失败返回 null（CSS 侧有兜底）
function hexToRgbTriple(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || '').trim())
  if (!m) return null
  return [m[1], m[2], m[3]].map((h) => parseInt(h, 16)).join(', ')
}

// 皮肤外观色块：按稀有度给不同的主色（纯占位，无官方素材）
function swatchColor(rarity, idx) {
  const map = {
    legendary: ['#8a5a10', '#f0c060'],
    epic:      ['#4a1a68', '#c07ae0'],
    rare:      ['#11466b', '#4ab8f0'],
    common:    ['#33393d', '#7f8b93']
  }
  return (map[rarity] || map.common)[idx]
}