/**
 * AnimatedList —— React Bits 官方组件（JS + CSS 版），按本站主题改造后内联维护。
 *
 * 上游：https://github.com/DavidHDev/react-bits
 *       src/content/Components/AnimatedList/{AnimatedList.jsx, AnimatedList.css}
 * 依赖：motion —— 本站 package.json 已有 motion@13.2.0，**未新增任何依赖**。
 *
 * ── 相对上游的改动（逐条对应本站接入需求，均就近注释）──────────
 *  1. renderItem：上游 items 只支持字符串（内部写死 <p className="item-text">）。
 *     新增自定义渲染回调，用来复用站内既有的段位行结构。
 *  2. itemDelay：上游把逐行 delay 写死 0.1s，提成 prop（默认仍 0.1 = 上游行为不变），
 *     调用方传 0.06 做逐行浮现。
 *  3. scrollProps / itemWrapperProps / scrollClassName：让调用方能给滚动容器补上
 *     data-lenis-prevent、tabIndex、role/aria，并复用站内已有的滚动条类名。
 *  4. 去掉 motion.div 上写死的 marginBottom:'1rem' / cursor:'pointer'
 *     —— 会破坏站内行距与全宽分割线；且段位行无点击行为，pointer 光标是误导。
 *  5. 配色全部改读站内 CSS 变量（见 AnimatedList.css），上游 #120F17 / #2F293A 已清零。
 *  6. 新增 onMouseLeave 复位选中行：上游的选中态是为键盘导航服务的（会一直停在上次
 *     鼠标划过的行）。本站关闭了键盘导航，选中态就只剩「hover 高亮」一种语义，
 *     停留不动不符合站内 hover 语言，故移出即复位。
 *
 * 注：AnimatedItem 里 useInView 的 `triggerOnce: false` 是上游写法。motion 该选项名为
 * `once` 且默认就是 false，所以此处行为等价于「滚出视口回退、滚回来重播」，
 * 与接入要求「triggerOnce 保持默认 false（回滚重播）」一致，未改动。
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, useInView } from 'motion/react'
import './AnimatedList.css'

/* 单行：进入视口 50% 时从 scale .7 + opacity 0 浮到终态；滚出即回退，滚回来重播。
   wrapperProps 放在动画 props 之前展开 —— 调用方只能追加（role/className 等），
   不能覆盖 initial/animate/transition 这套入场参数。 */
const AnimatedItem = ({ children, delay = 0, index, onMouseEnter, onClick, wrapperProps }) => {
  const ref = useRef(null)
  const inView = useInView(ref, { amount: 0.5, triggerOnce: false })
  return (
    <motion.div
      ref={ref}
      data-index={index}
      {...wrapperProps}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  )
}

const AnimatedList = ({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
  itemDelay = 0.1,        // 逐行错峰：第 i 行 delay = itemDelay × i（上游写死 0.1）
  renderItem,             // (item, index, { selected }) => ReactNode
  scrollClassName = '',   // 追加到滚动容器，便于复用站内既有类（如 .zs-shidian-list）
  scrollProps,            // 展开到滚动容器（data-lenis-prevent / tabIndex / role / aria）
  itemWrapperProps,       // 展开到每行的 wrapper（role 等）
}) => {
  const listRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)
  const [keyboardNav, setKeyboardNav] = useState(false)
  const [topGradientOpacity, setTopGradientOpacity] = useState(0)
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1)

  const handleItemMouseEnter = useCallback((index) => {
    setSelectedIndex(index)
  }, [])

  const handleItemClick = useCallback(
    (item, index) => {
      setSelectedIndex(index)
      if (onItemSelect) {
        onItemSelect(item, index)
      }
    },
    [onItemSelect]
  )

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    setTopGradientOpacity(Math.min(scrollTop / 50, 1))
    const bottomDistance = scrollHeight - (scrollTop + clientHeight)
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1))
  }, [])

  // 键盘导航：上游默认开启，并把 keydown 绑在 window 上 preventDefault 掉全页 ↑↓ / Tab / Enter。
  // 本站传 enableArrowNavigation={false} → 这里直接 return，不注册任何监听，
  // 页面其它键盘行为与原生键盘滚动都不受影响。
  useEffect(() => {
    if (!enableArrowNavigation) return
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault()
        setKeyboardNav(true)
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        setKeyboardNav(true)
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault()
          if (onItemSelect) {
            onItemSelect(items[selectedIndex], selectedIndex)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation])

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return
    const container = listRef.current
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedItem) {
      const extraMargin = 50
      const containerScrollTop = container.scrollTop
      const containerHeight = container.clientHeight
      const itemTop = selectedItem.offsetTop
      const itemBottom = itemTop + selectedItem.offsetHeight
      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' })
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: 'smooth',
        })
      }
    }
    setKeyboardNav(false)
  }, [selectedIndex, keyboardNav])

  return (
    <div className={`scroll-list-container ${className}`}>
      <div
        ref={listRef}
        className={`scroll-list ${!displayScrollbar ? 'no-scrollbar' : ''} ${scrollClassName}`}
        onScroll={handleScroll}
        /* 选中态复位：鼠标移出整块列表就清掉高亮（上游会一直停在上次划过的行） */
        onMouseLeave={() => setSelectedIndex(initialSelectedIndex)}
        {...scrollProps}
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={index}
            delay={itemDelay * index}
            index={index}
            onMouseEnter={() => handleItemMouseEnter(index)}
            onClick={() => handleItemClick(item, index)}
            wrapperProps={itemWrapperProps}
          >
            {renderItem ? (
              renderItem(item, index, { selected: selectedIndex === index })
            ) : (
              <div className={`item ${selectedIndex === index ? 'selected' : ''} ${itemClassName}`}>
                <p className="item-text">{item}</p>
              </div>
            )}
          </AnimatedItem>
        ))}
      </div>
      {showGradients && (
        <>
          <div className="top-gradient" style={{ opacity: topGradientOpacity }} />
          <div className="bottom-gradient" style={{ opacity: bottomGradientOpacity }} />
        </>
      )}
    </div>
  )
}

export default AnimatedList
