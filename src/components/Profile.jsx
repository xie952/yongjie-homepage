import { useState, useEffect } from 'react'
import ModeSection from './ModeSection'
import RankBadge from './RankBadge'
import { player } from '../data/stats'

/**
 * 档案版块：
 * - 左侧：头像/立绘占位（无图时用渐变色块 + 十字准星剪影，氛围感先顶上）
 * - 右侧：游戏ID + 段位徽章 + 简介 + 时长/入坑 + 常用英雄色块 + 常用武器 + 社交入口
 */
export default function Profile() {
  const [weaponModal, setWeaponModal] = useState(null) // { name, media } | null

  const openWeapon = (w) => setWeaponModal({ name: w.name, media: w.media || null })
  const closeWeapon = () => setWeaponModal(null)
  const isVideo = weaponModal?.media && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(weaponModal.media)

  useEffect(() => {
    if (!weaponModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') setWeaponModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [weaponModal])

  return (
    <ModeSection id="profile" no="01" title="玩家档案" en="PLAYER ARCHIVE"
      lead={`服务器 ${player.server} · 入坑 ${player.joinDate}`}>

      <div className="profile-grid">
        {/* —— 左：段位纹章（heroPortrait）/ 无图时剪影占位 —— */}
        <div className="profile-portrait" data-reveal="card">
          {player.heroPortrait ? (
            <div className="portrait-crest" aria-label={`${player.rank} 段位纹章`}>
              <img
                className="portrait-crest-img"
                src={player.heroPortrait}
                alt={`${player.rank} 段位纹章`}
                decoding="async"
              />
            </div>
          ) : (
            // 占位：人物剪影 + 渐变底，不含任何官方素材
            <div className="portrait-placeholder" aria-label="角色立绘占位">
              <svg viewBox="0 0 200 400" aria-hidden="true" className="portrait-silhouette">
                <circle cx="100" cy="80" r="42" fill="rgba(230,200,140,.35)" />
                <path
                  d="M100 140 C 30 150, 26 260, 24 300 L 30 396 H 170 L 176 300 C 174 260, 170 150, 100 140 Z"
                  fill="rgba(230,200,140,.30)"
                />
              </svg>
              <span className="portrait-hint">立绘占位<br />（后续替换）</span>
            </div>
          )}
          <RankBadge rank={player.rank} size="md" />
        </div>

        {/* —— 右：信息（纵向堆叠 → 整块上浮入场） —— */}
        <div className="profile-info" data-reveal="up">
          <div className="profile-id-row">
            <h3 className="profile-id">{player.id}</h3>
            <RankBadge rank={player.rank} size="sm" />
          </div>

          <p className="profile-bio">{player.bio}</p>

          {/* 时长 + 入坑年数 */}
          <div className="profile-metrics">
            <div className="profile-metric">
              <span className="profile-metric-num" data-count={player.playHours}>{player.playHours}</span>
              <span className="profile-metric-label">小时游戏时长</span>
            </div>
            <div className="profile-metric">
              <span className="profile-metric-num" data-count={Number(player.joinDate.slice(0, 4))}>{player.joinDate.slice(0, 4)}</span>
              <span className="profile-metric-label">入坑年份</span>
            </div>
          </div>

          {/* 常用英雄：色块头像 */}
          <div className="profile-block">
            <h4 className="profile-block-title">常用英雄</h4>
            <div className="profile-heroes">
              {player.favHeroes.map((h) => (
                <div key={h.name} className="hero-chip" title={h.name}>
                  {h.avatar ? (
                    <img className="hero-chip-avatar hero-chip-avatar--img" src={h.avatar} alt="" aria-hidden="true" />
                  ) : (
                    <span
                      className="hero-chip-avatar"
                      style={{ background: `linear-gradient(135deg, ${h.color[0]}, ${h.color[1]})` }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="hero-chip-name">{h.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 常用武器：点击弹出对应照片/视频 */}
          <div className="profile-block">
            <h4 className="profile-block-title">常用武器</h4>
            <div className="profile-weapons">
              {player.favWeapons.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  className={`weapon-chip${w.media ? ' weapon-chip--has-media' : ''}`}
                  onClick={() => openWeapon(w)}
                  aria-label={`查看${w.name}展示`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          {/* 社交账号入口：socials 为空时整块隐藏，避免空标题 */}
          {player.socials?.length > 0 && (
          <div className="profile-block">
            <h4 className="profile-block-title" data-reveal="up">社交媒体</h4>
            <div className="profile-socials" data-reveal-group>
              {player.socials.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <SocialIcon type={s.icon} />
                  <span>{s.name}</span>
                </a>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* 武器展示弹层：照片 / 视频 / 暂无素材 */}
      {weaponModal && (
        <div
          className="weapon-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${weaponModal.name}展示`}
          onClick={closeWeapon}
        >
          <div className="weapon-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <header className="weapon-lightbox-head">
              <span className="weapon-lightbox-title">{weaponModal.name}</span>
              <button type="button" className="weapon-lightbox-close" onClick={closeWeapon} aria-label="关闭">
                ×
              </button>
            </header>
            {weaponModal.media ? (
              isVideo ? (
                <video
                  className="weapon-lightbox-media"
                  src={weaponModal.media}
                  controls
                  autoPlay
                  playsInline
                  loop
                />
              ) : (
                <img
                  className="weapon-lightbox-media"
                  src={weaponModal.media}
                  alt={`${weaponModal.name}展示`}
                />
              )
            ) : (
              <div className="weapon-lightbox-empty">
                暂无照片或视频
                <span>把文件放进 public/ 后，在 stats.js 的 media 填路径即可</span>
              </div>
            )}
          </div>
        </div>
      )}
    </ModeSection>
  )
}

// 简易社交图标（纯 SVG 色块，不涉及品牌 Logo 版权，仅示意位置）
function SocialIcon({ type }) {
  const map = {
    bilibili: <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="2" y="6" width="20" height="14" rx="3" fill="currentColor" /><rect x="6" y="2" width="2" height="5" rx="1" fill="currentColor" /><rect x="16" y="2" width="2" height="5" rx="1" fill="currentColor" /></svg>,
    douyin: <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 3c.5 3 2.5 4.6 5 5v3c-1.8 0-3.4-.6-5-1.6V16a5.5 5.5 0 1 1-5.5-5.5c.3 0 .7 0 1 .1V14a3 3 0 1 0 3 3V3Z" fill="currentColor" /></svg>,
    weibo: <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="7" cy="16" r="5" fill="currentColor" /><circle cx="15" cy="6" r="2.4" fill="currentColor" /></svg>,
    weixin: <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 4C5.1 4 2 6.6 2 9.8c0 1.9 1 3.5 2.6 4.6L4 17l2.7-1.4c.7.2 1.5.3 2.3.3h.5A4.8 4.8 0 0 1 9 13.6c0-3.2 3.1-5.8 7-5.8.3 0 .6 0 .9.1C16.2 5.8 13 4 9 4Zm-2 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm8-3c0-2.4-2.7-4.4-6-4.4s-6 2-6 4.4 2.7 4.4 6 4.4c.6 0 1.1-.1 1.6-.2L21 21l-1-2.2c1.2-1 2-2.4 2-4Z" fill="currentColor" /></svg>,
  }
  return map[type] || (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor" /></svg>
  )
}