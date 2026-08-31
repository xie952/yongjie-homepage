/**
 * HeroCard —— 英雄卡片
 * 展示：英雄名、当前模式使用率、1-2 个常用皮肤（皮肤名 + 外观占位色块）
 * 皮肤根据 rarity 稀有度显示不同颜色的边框/标签。
 */

// 稀有度 → 标签文案 + 配色
const RARITY_STYLE = {
  legendary: { label: '传说', color: '#f0a020', bg: 'rgba(240,160,32,.14)' },
  epic:      { label: '史诗', color: '#b060e0', bg: 'rgba(176,96,224,.14)' },
  rare:      { label: '稀有', color: '#38a4e8', bg: 'rgba(56,164,232,.14)' },
  common:    { label: '普通', color: '#9aa5ad', bg: 'rgba(154,165,173,.12)' }
}

export default function HeroCard({ hero, usage }) {
  return (
    <article className="hero-card">
      <div className="hero-card-top">
        {/* 英雄头像占位：渐变色块 + 首字 */}
        <span className="hero-card-avatar" aria-hidden="true">
          {hero.name.slice(0, 1)}
        </span>
        <div className="hero-card-head">
          <h4 className="hero-card-name">{hero.name}</h4>
          {/* 使用率进度条 */}
          <div className="usage-bar">
            <div className="usage-bar-track">
              <div className="usage-bar-fill" style={{ width: `${usage}%` }} />
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
              style={{ borderColor: style.color + '55', background: style.bg }}
            >
              {/* 外观占位：用渐变块模拟皮肤外观（后续可替换为图片） */}
              <span
                className="skin-swatch"
                aria-hidden="true"
                style={{ background: `linear-gradient(135deg, ${swatchColor(skin.rarity, 0)} , ${swatchColor(skin.rarity, 1)})` }}
              />
              <div className="skin-info">
                <span className="skin-name">{skin.name}</span>
                <span className="skin-rarity" style={{ color: style.color }}>{style.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

// 皮肤外观色块：按稀有度给不同的渐变主色（纯占位，无官方素材）
function swatchColor(rarity, idx) {
  const map = {
    legendary: ['#8a5a10', '#f0c060'],
    epic:      ['#4a1a68', '#c07ae0'],
    rare:      ['#11466b', '#4ab8f0'],
    common:    ['#33393d', '#7f8b93']
  }
  return (map[rarity] || map.common)[idx]
}