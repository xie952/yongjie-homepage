import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * BuildDetailModal —— 魂玉搭配卡「详情图」弹窗（纯内存态，与路由 / hash 无关）
 *
 * 三条关键设计决定：
 * 1. 视觉语言沿用站内既有的武器弹层 `.weapon-lightbox`（遮罩/面板/标题栏/关闭钮/空态），
 *    但独立成组、不改 Profile 那份 —— 保证「其他模块零波及」。
 * 2. 用 createPortal 挂到 document.body：弹窗是 position:fixed，而站内 `.card-grid` 带
 *    perspective:1000px、卡片带 preserve-3d 与 GSAP transform —— 任何祖先一旦成为包含块，
 *    fixed 就会相对它定位并被裁剪。挂到 body 彻底规避，且 z-index 500 稳定压过 dock(300)。
 * 3. 常驻挂载 + `is-open` 类切换，**全程零定时器**：进出场交给 CSS 过渡，
 *    连续快速开关不会留下残影，也不存在「定时器没清干净」导致的动画卡死。
 */
export default function BuildDetailModal({ build, onClose, returnFocusRef }) {
  // 保留最后一张卡的数据：关闭动画播放期间不能先清空，否则会闪一下空白
  const [shown, setShown] = useState(build)
  const [imgFailed, setImgFailed] = useState(false)
  const closeBtnRef = useRef(null)
  const panelRef = useRef(null)
  const scrollRef = useRef(null)
  const isOpen = !!build

  useEffect(() => { if (build) setShown(build) }, [build])
  // 换卡（或同一张重新打开）时重置图片失败标记
  useEffect(() => { setImgFailed(false) }, [shown])

  // 打开：锁滚动 + 焦点移入弹窗；关闭：全部还原 + 焦点还回触发的卡片
  useEffect(() => {
    if (!isOpen) return
    // 站内是 Lenis 平滑滚动：必须让它停摆，只靠 overflow:hidden 是拦不住的
    const lenis = window.__lenis
    lenis?.stop?.()
    // html 已常驻 scrollbar-gutter:stable，所以锁滚动不会改变布局宽度（§7 铁律）
    document.documentElement.classList.add('detail-lock')
    // 等一帧再聚焦：确保 is-open 的可见性样式已生效（visibility:hidden 的元素不可聚焦）
    const focusRaf = requestAnimationFrame(() => {
      const target = closeBtnRef.current || panelRef.current
      try { target?.focus({ preventScroll: true }) } catch { /* 拿不到焦点就不抢 */ }
    })

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    // document + 捕获阶段：比 window 冒泡更早触发，别人在冒泡里 stopPropagation 也拦不掉
    document.addEventListener('keydown', onKey, true)

    return () => {
      cancelAnimationFrame(focusRaf)
      document.removeEventListener('keydown', onKey, true)
      document.documentElement.classList.remove('detail-lock')
      lenis?.start?.()
      // 焦点回退：优先还给触发卡片；卡片已不在 DOM 时退回到仍在的第一张魂玉卡；
      // 都不存在就保持不动（不乱抢焦点）
      const back = returnFocusRef?.current
      const target = back && document.body.contains(back) ? back : document.querySelector('.build-card')
      if (target && document.body.contains(target)) target.focus({ preventScroll: true })
    }
  }, [isOpen, onClose, returnFocusRef])

  const hasImg = !!shown?.detailImg && !imgFailed

  return createPortal(
    <div
      className={`build-lightbox${isOpen ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={shown ? `${shown.name} · ${shown.build} 详情` : '魂玉搭配详情'}
      onClick={onClose}
    >
      {/* tabIndex=-1：兜底的聚焦目标（关闭按钮拿不到焦点时用它） */}
      <div className="build-lightbox-panel" ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <header className="build-lightbox-head">
          <span className="build-lightbox-titles">
            <span className="build-lightbox-title">{shown?.name}</span>
            <span className="build-lightbox-flow">{shown?.build}</span>
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="build-lightbox-close"
            onClick={onClose}
            aria-label="关闭详情"
          >
            ×
          </button>
        </header>

        {/* 主体外层只做两件事：承载 fixed 尺寸 + overflow:hidden 裁剪扫光（防出界）。
            真正的滚动交给内层 .build-lightbox-scroll —— 长图在弹窗内独立滚动，
            短图容器不拉伸（img 宽度 100% + height auto，等比不裁切不变形）。 */}
        <div className="build-lightbox-media">
          {hasImg ? (
            <>
              {/* data-lenis-prevent 是必须的：弹窗打开时调了 lenis.stop()，而 Lenis 在
                  「已停摆」分支里仍然会 event.preventDefault() 把滚轮整个吃掉
                  （lenis.mjs:613-616），滚轮就永远到不了这个容器 → 长图滚不动。
                  该属性会让 Lenis 在更早的 :609-612 直接 return，放行原生滚动。 */}
              <div className="build-lightbox-scroll" ref={scrollRef} data-lenis-prevent>
                <img
                  className="build-lightbox-img"
                  src={shown.detailImg}
                  alt={`${shown.name} · ${shown.build} 详细图`}
                  onError={() => setImgFailed(true)}
                />
              </div>
              {/* 进场后一次光泽扫过：几何与时长直接复用卡片剑气的 .card-sheen + cardSheen 关键帧 */}
              <span className="card-sheen" aria-hidden="true" />
            </>
          ) : (
            /* 素材缺失 / 加载失败都走这里：暗色纹理区 + 低透明度占位文案，不报错、不空白 */
            <div className="build-lightbox-empty">
              详细图待补充
              <span>把图片放进 public/ 后，在 stats.js 的 detailImg 填路径即可</span>
            </div>
          )}
        </div>

        {shown?.jades?.length > 0 && (
          <footer className="build-lightbox-foot">
            {/* 标签样式直接复用卡片上的 .jade-chip */}
            <div className="jade-row">
              {shown.jades.map((j) => <span key={j} className="jade-chip">{j}</span>)}
            </div>
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}
