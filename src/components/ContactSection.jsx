import { useState } from 'react'
import { player, closing, tianxuan, zhengshen, wujian } from '../data/stats'

/**
 * 收尾页 —— 整屏组队招募
 * 视觉与首屏呼应：深色底 + 金色装饰，中间大字招募语 + 联系方式。
 * 页面底部展示"数据更新于 X 天前"（取三个模式中最近的一个日期计算）。
 */
export default function ContactSection() {
  /* 复制反馈记「复制的是哪一项」（'' | 'id'）—— 原本还有微信/社区两张卡，
     2026-10-02 按要求把那一块整体删掉，现在只剩游戏 ID 一处。 */
  const [copiedKey, setCopiedKey] = useState('')

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 1800)
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
        <div className="closing-head" data-reveal-group>
          <h2 className="closing-title" data-split>{closing.title}</h2>
          <p className="closing-subtitle" data-reveal="up">{closing.subtitle}</p>
        </div>

        <div className="closing-contact" data-reveal="up">
          <button className="btn btn-primary btn-lg" onClick={() => copy(closing.contact.gameId, 'id')} aria-live="polite">
            {copiedKey === 'id' ? '游戏ID已复制 ✓' : `复制游戏ID：${closing.contact.gameId}`}
          </button>
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
  // ⚠️ 不能写成 dates[0].toISOString().slice(0, 10)：toISOString 走 UTC，
  // 东八区下"本地零点"会被折回前一天（2026-09-14 → 2026-09-13），页脚日期平白少一天。
  // 这里按【本地】年月日拼串，与 daysSince() 的"本地零点"口径保持一致。
  return formatLocalDate(dates[0])
}

// 本地日期 → YYYY-MM-DD（全程本地时区，不经过 UTC）
function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 距今天数（本地零点 → 本地零点，按自然日）
function daysSince(dateStr) {
  const now = new Date()
  // 今天也要取本地零点：若直接用 new Date()（带时分秒），下午访问会比上午多算一天
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(dateStr + 'T00:00:00')
  const diff = today - d
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}