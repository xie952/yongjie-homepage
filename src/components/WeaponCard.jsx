/**
 * WeaponCard —— 武器卡片
 * 结构同 HeroCard：武器名、当前模式使用率、1-2 个武器皮肤。
 */
const RARITY_STYLE = {
  legendary: { label: '传说', color: '#f0a020' },
  epic:      { label: '史诗', color: '#b060e0' },
  rare:      { label: '稀有', color: '#38a4e8' },
  common:    { label: '普通', color: '#9aa5ad' }
}

export default function WeaponCard({ weapon, usage }) {
  return (
    <article className="weapon-card">
      <div className="weapon-card-top">
        {/* 武器色块占位：竖条金属渐变 */}
        <span className="weapon-card-icon" aria-hidden="true">刃</span>
        <div className="weapon-card-head">
          <h4 className="weapon-card-name">{weapon.name}</h4>
          <div className="usage-bar">
            <div className="usage-bar-track">
              <div className="usage-bar-fill usage-bar-fill--weapon" style={{ width: `${usage}%` }} />
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
              style={{ borderColor: style.color + '55' }}
            >
              {/* 武器皮肤外观占位：斜切金属条 */}
              <span className="weapon-swatch" aria-hidden="true">
                <i style={{ background: weaponSwatch(skin.rarity) }} />
              </span>
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

function weaponSwatch(rarity) {
  const map = {
    legendary: 'linear-gradient(90deg,#5a3a08,#d8a830,#5a3a08)',
    epic:      'linear-gradient(90deg,#2c0f40,#9a4ac8,#2c0f40)',
    rare:      'linear-gradient(90deg,#0a2c44,#2a90d0,#0a2c44)',
    common:    'linear-gradient(90deg,#23282c,#68747c,#23282c)'
  }
  return map[rarity] || map.common
}