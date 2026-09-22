import { useState } from 'react'
import { player } from '../data/stats'
import HeroTitleArt from './HeroTitleArt'
import MagneticButton from './MagneticButton'

// ══════════════════════════════════════════════════════════════
// ⭐ 背景视频地址 —— 想换成你自己的视频，只改这一行就行 ⭐
// 视频文件放在 public/ 目录下，路径写 /videos/hero-ink.mp4（public 下的根路径）
// 加载策略：poster 先显示（/hero-poster.webp），video canplay 后交叉淡入
// 若文件不存在或加载失败，页面永久显示 poster 静帧，绝不空白
// ══════════════════════════════════════════════════════════════
const HERO_VIDEO = '/videos/hero-ink.mp4'
const HERO_POSTER = '/hero-poster.webp'
const SLOGAN_CHARS = Array.from('「我身无拘，武道无穷」')

/**
 * Hero —— 全屏首屏（水墨视频背景 + 三层同向视差 + 滚动入场）
 * 结构（自上而下）：
 *   .hero-media       视频层架构 wrapper（承载视差 translate，rAF 驱动）
 *     .hero-poster    poster 静帧层（视频就绪前显示，加载失败永久停留）
 *     .hero-video     video 元素（承载滚动穿透 scale，ScrollTrigger 驱动）
 *   .hero-mask        暗色遮罩 + 上下晕影（不参与任何动画）
 *   .hero-bg          粒子/光晕兜底层（视频上层兜底，通常被视频盖住）
 *   .hero-inner       内容容器（承载滚动穿透 content opacity/y）
 *     .hero-float     文本视差 wrapper（承载 ±4px translate，独立 transform 源）
 * 结构铁律：视差 translate / 滚动穿透 scale / 文本位移 各写不同元素，零冲突
 */
export default function Hero() {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <section className="hero hero--cinema hero-anims-pending" id="top">
      {/* ---- 水墨视频背景层架构（视差 wrapper 在 fx 的 initHeroParallax 接管） ---- */}
      <div className="hero-media" aria-hidden="true">
        {/* poster 静帧：视频就绪前显示，加载失败永久停留；video canplay 后由
            fx.js 给 .hero-media 加 .is-loaded 类做 0.8s 交叉淡入（不走 React 重渲染） */}
        <img
          className={`hero-poster${videoFailed ? ' hero-poster--stay' : ''}`}
          src={HERO_POSTER}
          alt=""
        />
        <video
          className={`hero-video${videoFailed ? ' hero-video--failed' : ''}`}
          src={HERO_VIDEO}
          poster={HERO_POSTER}
          loop
          muted
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
        />
        {/* WebGL 水波画布：覆盖视频位置，纹理源就是上面的 <video>（video 仍解码但不显示）。
            由 fx.js 的 initFluidHero 接管；WebGL 不可用 / 低端设备 / reduced-motion 时
            不会加 .is-fluid → 画布保持透明，视频照常直出（降级路径，其余一切不变） */}
        <canvas className="hero-canvas" aria-hidden="true" />
        {/* 立绘层：视差结构先行（±20px 由 fx.js 写在 .hero-art 外壳上，本层不放 transform）。
            立绘图路径来自 stats.js 的 player.artPortrait —— null 时保持空占位（现状不变），
            填入路径（如 "/hero-art.webp"）即自动显示；onLoad 只加 class 触发 CSS 淡入，
            不走 setState（避免 React 重渲染，与 initHeroVideo 的纯 class 淡入同思路） */}
        <div className="hero-art" aria-hidden="true">
          {player.artPortrait ? (
            <img
              className="hero-art-img"
              src={player.artPortrait}
              alt=""
              decoding="async"
              onLoad={(e) => e.currentTarget.classList.add('is-ready')}
            />
          ) : null}
        </div>
      </div>

      {/* ---- 暗色遮罩 + 上下晕影（视频之上、内容之下，不参与动画） ---- */}
      <div className="hero-mask" aria-hidden="true" />
      {/* ---- 视频下方的粒子/光晕兜底层（视频起来后被盖住） ---- */}
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-ink ink-1" />
        <div className="hero-ink ink-2" />
        <div className="hero-particles" />
      </div>

      <div className="container hero-inner">
        {/* 文本视差 wrapper：与下方 GSAP 墨迹显形 / 滚动穿透分属不同元素 */}
        <div className="hero-float">
          <p className="hero-subtitle" id="hero-ink-subtitle">个人主页网站</p>
          {/* 大标题 + 红印章 = 一张"图片"（自绘 SVG：水墨笔触 + 朱红印章，含落款）
              - 默认用内置矢量图像：印章文字取自 player.id，换 ID 自动同步
              - 若 stats.js 的 player.titleLogo 填了图片路径 → 换成你自己的图片（整幅淡入）
              - 逐字墨迹显形 / 盖章落印的动画钩子（.hero-char / #hero-ink-seal）保持不变 */}
          <div className="hero-title-wrap" id="hero-ink-title-wrap">
            <h1 className="hero-title hero-title--cinema" id="hero-ink-title" aria-label="永劫无间">
              {player.titleLogo ? (
                <img className="hero-title-image" src={player.titleLogo} alt="永劫无间" decoding="async" />
              ) : (
                <HeroTitleArt />
              )}
            </h1>
          </div>
          <p className="hero-slogan" id="hero-ink-slogan">
            {SLOGAN_CHARS.map((ch, i) => (
              <span className="hero-slogan-char" key={`${ch}-${i}`}>
                {i === 0 ? `${ch} ` : i === SLOGAN_CHARS.length - 1 ? ` ${ch}` : ch}
              </span>
            ))}
          </p>

          {/* 分层（防 transform 打架）：
              外层 .hero-actions —— 承接入场 fade-up 与滚动穿透淡出（GSAP 只碰这一层）
              中层 MagneticButton —— 只写磁性位移 translate(sx, sy)
              内层按钮本体 —— 白底胶囊 + 锚点跳转，样式与行为一字未改 */}
          <div className="hero-actions" id="hero-ink-actions">
            <MagneticButton fieldSelector="#top">
              <a className="hero-detail-btn" href="#tianxuan">查看主页</a>
            </MagneticButton>
          </div>
        </div>
      </div>

      {/* 底部滚动提示 */}
      <a className="hero-scroll-hint" href="#profile" aria-label="向下滚动查看档案">
        <span className="hero-scroll-line" aria-hidden="true" />
      </a>
    </section>
  )
}
