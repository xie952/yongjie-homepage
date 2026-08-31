import { useState } from 'react'
import { player, closing, tianxuan, zhengshen, wujian } from '../data/stats'

/**
 * 收尾页 —— 整屏组队招募
 * 视觉与首屏呼应：深色底 + 金色装饰，中间大字招募语 + 联系方式。
 * 页面底部展示"数据更新于 X 天前"（取三个模式中最近的一个日期计算）。
 */
export default function ContactSection() {
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(closing.contact.gameId)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = closing.contact.gameId
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // 三个模式里最近的更新日期
  const latest = latestUpdateDate()
  const daysAgo = daysSince(latest)

  return (
    <section className="closing" id="contact">
      {/* 与首屏呼应的背景光晕 */}
      <div className="closing-bg" aria-hidden="true">
        <div className="closing-ink" />
      </div>

      <div className="container closing-inner">
        <p className="closing-kicker">— 江湖路远 · 后会有期 —</p>
        <h2 className="closing-title">{closing.title}</h2>
        <p className="closing-subtitle">{closing.subtitle}</p>

        <div className="closing-contact">
          <button className="btn btn-primary btn-lg" onClick={copyId} aria-live="polite">
            {copied ? '游戏ID已复制 ✓' : `复制游戏ID：${closing.contact.gameId}`}
          </button>

          <div className="closing-links">
            <span className="closing-link">
              <span className="closing-link-label">微信</span>
              <span className="closing-link-value">{closing.contact.wechat}</span>
            </span>
            <span className="closing-sep" aria-hidden="true" />
            <a className="closing-link" href="https://discord.com/" target="_blank" rel="noopener noreferrer">
              <span className="closing-link-label">社区</span>
              <span className="closing-link-value">{closing.contact.discord}</span>
            </a>
          </div>
        </div>

        <footer className="closing-foot">
          <span>非官方个人网站 · 数据仅为个人战绩展示</span>
          <span className="closing-foot-updated">
            数据更新于 {daysAgo === 0 ? '今天' : `${daysAgo} 天前`}
            <span className="closing-foot-date">（{latest}）</span>
          </span>
        </footer>
      </div>
    </section>
  )
}

// 从三个模式数据里找出最近的更新日期字符串
function latestUpdateDate() {
  const dates = [tianxuan.lastUpdated, zhengshen.lastUpdated, wujian.lastUpdated]
    .map((d) => new Date(d + 'T00:00:00'))
    .sort((a, b) => b - a)
  const latest = dates[0]
  // 格式化成 YYYY-MM-DD
  return latest.toISOString().slice(0, 10)
}

// 距今天数（按自然日）
function daysSince(dateStr) {
  const today = new Date()
  const d = new Date(dateStr + 'T00:00:00')
  const diff = today - d
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}