import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

/**
 * TabGroup —— 标签页切换组件
 * 特性：
 *  1. 点击 / 键盘左右箭头切换（带 ARIA 无障碍属性）
 *  2. 通过 URL hash 同步当前标签，方便分享直链，如 #tianxuan-solo
 *  3. 切换时内容有平滑淡入过渡（旧面板淡出后新面板错峰入场）
 *
 * 用法：
 *   <TabGroup baseHash="tianxuan" tabs={[{id:'solo', label:'单排', content:<div/>}]} />
 */
const isReduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function TabGroup({ baseHash, tabs, defaultId }) {
  // 当前激活的标签 id，默认取第一个
  const [activeId, setActiveId] = useState(defaultId || tabs[0].id)
  const tabRefs = useRef({})
  const panelRef = useRef(null)

  // 计算某个标签对应的 hash：如 baseHash=tianxuan, id=solo → "#tianxuan-solo"
  const hashFor = (id) => `#${baseHash}-${id}`

  // 页面加载 / hash 变化时，尝试同步标签
  useEffect(() => {
    const syncFromHash = () => {
      const h = window.location.hash
      // 匹配 "#baseHash-标签id"
      const match = h.match(new RegExp(`^#${baseHash}-([\\w]+)$`))
      if (match && tabs.some((t) => t.id === match[1])) {
        // URL 带明确模式 hash：以 URL 为准
        setActiveId(match[1])
      } else {
        // 无模式 hash（裸 #tianxuan、#profile、无 hash 等）→ 默认标签
        setActiveId(defaultId || tabs[0].id)
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [baseHash, tabs, defaultId])

  // 切换标签（快速连点安全版）：
//   - 首个点击：立即 commit（切换面板）
//   - 入场动画期间（约 0.5s 锁）：后续点击只更新 pendingRef
//   - 解锁时若 pendingRef 有更新 → 再切到"最后一次点击"的目标
//   → 最终状态恒等于最后一次点击；无动画叠加、无旧面板淡出竞态
  const switchingRef = useRef(false)
  const pendingRef = useRef(null)
  const activate = (id) => {
    if (isReduceMotion()) {
      commit(id)
      return
    }
    pendingRef.current = id
    if (switchingRef.current) return // 入场期间：仅记录最新目标

    switchingRef.current = true
    const firstId = id
    commit(firstId) // 立即切到首个目标
    gsap.delayedCall(0.5, () => {
      const latest = pendingRef.current
      pendingRef.current = null
      switchingRef.current = false
      if (latest && latest !== firstId) {
        activate(latest) // 用户又点了别的：补切到最新
      }
    })
  }

  const commit = (id) => {
    setActiveId(id)
    // 用 replaceState 改地址栏，不新增历史，方便"后退"仍回到上一版块
    const targetHash = hashFor(id)
    if (window.location.hash !== targetHash) {
      history.replaceState(null, '', targetHash)
    }
    // 通知动效层：内容已重建，可重新绑定入场/流光/指示器（fx.js 监听此事件）
    // 必须用 document.dispatchEvent（事件默认不冒泡，window 派发 document 监听不到）
    document.dispatchEvent(new CustomEvent('tabchange', { detail: { baseHash, id } }))
  }

  // 键盘左右切换（无障碍）
  const onKeyDown = (e, index) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = (index + dir + tabs.length) % tabs.length
    activate(tabs[next].id)
    tabRefs.current[tabs[next].id]?.focus()
  }

  const activeTab = tabs.find((t) => t.id === activeId) || tabs[0]

  return (
    <div className="tab-group">
      {/* 标签按钮行：role="tablist" 声明这是一组标签 */}
      <div className="tab-bar" role="tablist" aria-label={baseHash}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[tab.id] = el)}
            role="tab"
            id={`tab-${baseHash}-${tab.id}`}
            aria-selected={tab.id === activeId}
            aria-controls={`panel-${baseHash}-${tab.id}`}
            tabIndex={tab.id === activeId ? 0 : -1}
            className={`tab-btn${tab.id === activeId ? ' is-active' : ''}`}
            onClick={() => activate(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容面板：key 变化触发重新挂载 → 平滑淡入（fx.js tabchange 统一处理） */}
      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${baseHash}-${activeTab.id}`}
        aria-labelledby={`tab-${baseHash}-${activeTab.id}`}
        key={activeTab.id}
        ref={panelRef}
      >
        {activeTab.content}
      </div>
    </div>
  )
}