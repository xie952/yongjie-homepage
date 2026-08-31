import { useEffect, useRef, useState } from 'react'

/**
 * TabGroup —— 标签页切换组件
 * 特性：
 *  1. 点击 / 键盘左右箭头切换（带 ARIA 无障碍属性）
 *  2. 通过 URL hash 同步当前标签，方便分享直链，如 #tianxuan-solo
 *  3. 切换时内容有平滑淡入过渡
 *
 * 用法：
 *   <TabGroup baseHash="tianxuan" tabs={[{id:'solo', label:'单排', content:<div/>}]} />
 */
export default function TabGroup({ baseHash, tabs, defaultId }) {
  // 当前激活的标签 id，默认取第一个
  const [activeId, setActiveId] = useState(defaultId || tabs[0].id)
  const tabRefs = useRef({})

  // 计算某个标签对应的 hash：如 baseHash=tianxuan, id=solo → "#tianxuan-solo"
  const hashFor = (id) => `#${baseHash}-${id}`

  // 页面加载 / hash 变化时，尝试同步标签
  useEffect(() => {
    const syncFromHash = () => {
      const h = window.location.hash
      // 匹配 "#baseHash-标签id"
      const match = h.match(new RegExp(`^#${baseHash}-([\\w]+)$`))
      if (match && tabs.some((t) => t.id === match[1])) {
        setActiveId(match[1])
      } else if (!h || h === `#${baseHash}`) {
        // 直接命中版块锚点（如 #tianxuan）时回到默认标签
        setActiveId(defaultId || tabs[0].id)
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [baseHash, tabs, defaultId])

  // 切换标签：更新状态 + 更新 URL hash（replace 避免产生多余历史记录）
  const activate = (id) => {
    setActiveId(id)
    // 用 replaceState 改地址栏，不新增历史，方便"后退"仍回到上一版块
    const targetHash = hashFor(id)
    if (window.location.hash !== targetHash) {
      history.replaceState(null, '', targetHash)
    }
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

      {/* 内容面板：key 变化触发重新挂载 → 平滑淡入 */}
      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${baseHash}-${activeTab.id}`}
        aria-labelledby={`tab-${baseHash}-${activeTab.id}`}
        key={activeTab.id}
      >
        {activeTab.content}
      </div>
    </div>
  )
}