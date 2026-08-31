import { useState } from 'react'
import { player } from '../data/stats'

/**
 * Hero —— 全屏首屏
 * 1. 动态背景：CSS 粒子（金色尘埃漂浮）+ 水墨流动光晕，纯 CSS 无需图片
 * 2. 游戏 ID 大标题 + slogan
 * 3. "加我组队"按钮：点击复制游戏 ID 到剪贴板，提示成功
 */
export default function Hero() {
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(player.id)
    } catch (err) {
      // 旧浏览器兜底：用隐藏文本域复制
      const ta = document.createElement('textarea')
      ta.value = player.id
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section className="hero" id="top">
      {/* ---- 动态背景层：纯 CSS，无需任何图片资源 ---- */}
      <div className="hero-bg" aria-hidden="true">
        {/* 水墨流动光晕：两团缓慢旋转/漂移的柔光 */}
        <div className="hero-ink ink-1" />
        <div className="hero-ink ink-2" />
        {/* 金色尘埃粒子：用多个小圆点模拟漂浮的沙尘/火星 */}
        <div className="hero-particles" />
      </div>

      <div className="container hero-inner">
        <p className="hero-eyebrow">永劫无间 · 个人战绩主页</p>
        <h1 className="hero-title">
          <span className="hero-title-main">{player.id}</span>
        </h1>
        <p className="hero-slogan">「 {player.slogan} 」</p>

        <div className="hero-actions">
          {/* aria-live 让读屏器朗读复制成功提示 */}
          <button className="btn btn-primary" onClick={copyId} aria-live="polite">
            <span className="btn-icon" aria-hidden="true">⚔</span>
            {copied ? '游戏ID已复制 ✓' : '加我组队'}
          </button>
          <a className="btn btn-ghost" href="#tianxuan">查看战绩</a>
        </div>
      </div>

      {/* 底部滚动提示 */}
      <a className="hero-scroll-hint" href="#profile" aria-label="向下滚动查看档案">
        <span className="hero-scroll-line" aria-hidden="true" />
      </a>
    </section>
  )
}