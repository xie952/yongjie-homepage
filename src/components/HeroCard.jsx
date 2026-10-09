/**
 * HeroCard —— 英雄卡片
 * 展示：英雄名、当前模式使用率、1-2 个常用皮肤（皮肤名 + 外观占位色块）
 * 皮肤根据 rarity 稀有度显示不同颜色的边框/标签。
 *
 * ── 翻面（P0，2026-09-22 新增）──────────────────────────────
 * 点击卡片 → 绕 Y 轴翻转，背面显示该英雄在单/双/三排三模式下的使用率
 * （数据全部来自 stats.js 的 useByMode；正面只显示当前 Tab 那一个数，
 *  背面是它的横向对照，不新增任何数据字段）。
 * 两条硬约束，改前务必读懂：
 * ① 旋转必须落在内层 .card-3d 上：卡片自身的 transform 已被 fx.js 的 GSAP tilt
 *    占用（quickTo rotationX / rotationY），在卡片上写 rotateY 会与 tilt 抢同一个
 *    transform（CSS transition 与 GSAP 逐帧写值互相覆盖）。
 * ② .card-3d / .card-face--front 必须 preserve-3d，否则卡内 translateZ(44/26/18/12px)
 *    景深链断裂，头像等会被压平（同 index.css 里 overflow:hidden 压平 preserve-3d 的实测教训）。
 * 背面用 absolute + rotateY(180deg) + backface-visibility:hidden，不参与布局
 * → 静止时卡片尺寸、排版、hover/剑光/tilt 全部与改动前一致。
 */
import { useState } from 'react'
import Reveal from './Reveal'

// 稀有度 → 标签文案 + 配色
const RARITY_STYLE = {
  legendary: { label: '传说', color: '#f0a020', bg: 'rgba(240,160,32,.14)' },
  epic:      { label: '史诗', color: '#b060e0', bg: 'rgba(176,96,224,.14)' },
  rare:      { label: '稀有', color: '#38a4e8', bg: 'rgba(56,164,232,.14)' },
  common:    { label: '普通', color: '#9aa5ad', bg: 'rgba(154,165,173,.12)' }
}

// 模式 id → 中文标签（与 TianxuanSection 的 MODE_TABS 同文案；那边未导出，此处独立维护一份）
const MODE_LABELS = { solo: '单排', duo: '双排', trio: '三排' }

export default function HeroCard({ hero, usage, index = 0 }) {
  // 翻面状态：只在客户端交互时变，不影响任何服务端渲染/布局
  const [flipped, setFlipped] = useState(false)
  const toggleFlip = () => setFlipped((v) => !v)

  // 英雄主题色 → CSS 变量：--hero-theme（hex，给进度条渐变用）
  //                     --hero-theme-rgb（r, g, b 三元组，配 rgba 透明度做边框/光晕）
  // 与排位模式无关：切 Tab 只改 usage，变量不变
  const themeRgb = hexToRgbTriple(hero.themeColor)
  return (
    <Reveal
      as="article"
      variant="card"
      index={index}
      className={`hero-card${flipped ? ' is-flipped' : ''}`}
      /* 指针点击挂在卡片本身（实测：铺满卡片的透明按钮收不到鼠标点击 ——
         .hero-card 是 preserve-3d 场景，命中测试按【深度】排序，卡内 translateZ(44/26/18/12px)
         的内容永远排在 z=0 的浮层按钮前面，elementsFromPoint 显示按钮在最上层但点击落到 article）。
         键盘可达性由下面那个 <button> 保留（Enter/Space 会派发 click 到按钮本身）。 */
      onClick={toggleFlip}
      style={{
        '--hero-theme': hero.themeColor,
        ...(themeRgb ? { '--hero-theme-rgb': themeRgb } : null),
      }}
    >
      <div className="card-3d">
        {/* ── 正面：原有用例，逐字未改 ── */}
        <div className="card-face card-face--front">
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
        </div>

        {/* ── 背面：三模式使用率（数据源 = 同一个 useByMode，不新增字段） ── */}
        <div className="card-face card-face--back">
          <span className="card-back-title">各模式使用率</span>
          <div className="card-back-rows">
            {Object.entries(hero.useByMode || {}).map(([id, pct]) => (
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

      {/* 翻面开关：铺满卡片的透明按钮（**不随卡片旋转**，所以放在 .card-3d 之外）。
          做成真 <button> 而不是给 article 挂 onClick —— article 内含 <h4>，
          给 article 加 role="button" 属于无效 ARIA（按钮内不能有标题）。
          pointer-events 正常，fx.js 绑在卡片上的 mouseenter/mousemove 照样冒泡生效。 */}
      <button
        type="button"
        className="card-flip-toggle"
        aria-pressed={flipped}
        aria-label={`翻转卡片，查看 ${hero.name} 在单排/双排/三排的使用率`}
        onClick={toggleFlip}
      />
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
