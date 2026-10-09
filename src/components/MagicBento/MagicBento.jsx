/**
 * MagicBento —— React Bits 官方组件（JS + CSS 版），按本站主题与数据接入改造后内联维护。
 *
 * 上游：https://github.com/DavidHDev/react-bits
 *       src/content/Components/MagicBento/{MagicBento.jsx, MagicBento.css}
 * 依赖：gsap —— 本站 package.json 已有 gsap@^3.15.0，**未新增任何依赖**。
 *
 * ── 相对上游的改动（逐条对应接入要求）──────────────────────────
 *  1. 删除写死的 6 条示例 cardData；改为 items + renderItem 由外部传入，
 *     卡面结构完全交回站内既有组件（左上角切角 / 指标名 / 金色数值 / 数字滚动），
 *     不再使用上游的 header(label) + content(title + desc)。
 *  2. glowColor 默认值不再是上游那串紫色三元组，改为运行时读站内 --gold 现算出的
 *     "r, g, b" 字符串，并把结果写进 CSS 变量 --glow-rgb（样式表里的紫色全部改读它）。
 *  3. 栅格类名 .card-grid → .magic-bento-grid（上游这个类名与站内 index.css:1321 冲突，
 *     会改掉英雄卡/武器卡/魂玉卡三处网格的 gap/padding/max-width）。
 *     列定义与间距改由 gridClassName 传入站内 .stat-grid。
 *  4. 新增 gridClassName / gridProps 两个透传口，便于挂站内类名与 data-* 标记。
 *  5. 默认值按接入要求调整：enableStars=false、enableTilt=false、textAutoHide=false、
 *     enableMagnetism=false（站内 .stat-card:hover 自带 translateY(-5px) 位移，
 *     磁吸会与它抢同一个 transform，故关闭）。
 *  6. textAutoHide 的省略号裁剪规则已从样式表移除，文字与数字不裁切。
 *  7. ≤768px 自动降级（MOBILE_BREAKPOINT / useMobileDetection）保持上游原样。
 *
 * 注：聚光元素仍是上游那个 800px fixed 光斑 + 全局 mousemove，但 z-index 由 200 降到 20、
 * 并保留 pointer-events: none（见 MagicBento.css 注释），确保不遮挡也不拦截
 * dock(300) / 弹窗(500) / preloader(2147483000) 的事件与视觉。
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { gsap } from 'gsap'
import './MagicBento.css'

const DEFAULT_PARTICLE_COUNT = 12
const DEFAULT_SPOTLIGHT_RADIUS = 300
const MOBILE_BREAKPOINT = 768

/* 主题金 → "r, g, b"：读站内 :root 的 --gold（#d4af58）现算，不在 JS 里另立第二份金色。
   解析失败时回退的三元组就是站内 CSS 早已在用的那枚金色
   （index.css 多处 \`rgba(var(--hero-theme-rgb, var(--card-rarity-rgb, 212, 175, 88)), …)\`），
   属既有色值，不是本次新引入的。 */
const GOLD_FALLBACK_RGB = '212, 175, 88'
function readThemeGoldRgb() {
  if (typeof document === 'undefined') return GOLD_FALLBACK_RGB
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(raw)
  if (!m) return GOLD_FALLBACK_RGB
  return [m[1], m[2], m[3]].map((h) => parseInt(h, 16)).join(', ')
}

const createParticleElement = (x, y, color) => {
  const el = document.createElement('div')
  el.className = 'particle'
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.6);
    pointer-events: none;
    z-index: 100;
    left: ${x}px;
    top: ${y}px;
  `
  return el
}

const calculateSpotlightValues = (radius) => ({
  proximity: radius * 0.5,
  fadeDistance: radius * 0.75,
})

const updateCardGlowProperties = (card, mouseX, mouseY, glow, radius) => {
  const rect = card.getBoundingClientRect()
  const relativeX = ((mouseX - rect.left) / rect.width) * 100
  const relativeY = ((mouseY - rect.top) / rect.height) * 100

  card.style.setProperty('--glow-x', `${relativeX}%`)
  card.style.setProperty('--glow-y', `${relativeY}%`)
  card.style.setProperty('--glow-intensity', glow.toString())
  card.style.setProperty('--glow-radius', `${radius}px`)
}

const ParticleCard = ({
  children,
  className = '',
  disableAnimations = false,
  style,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor,
  enableTilt = true,
  clickEffect = false,
  enableMagnetism = false,
}) => {
  const cardRef = useRef(null)
  const particlesRef = useRef([])
  const timeoutsRef = useRef([])
  const isHoveredRef = useRef(false)
  const memoizedParticles = useRef([])
  const particlesInitialized = useRef(false)
  const magnetismAnimationRef = useRef(null)

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return
    const { width, height } = cardRef.current.getBoundingClientRect()
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor)
    )
    particlesInitialized.current = true
  }, [particleCount, glowColor])

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    magnetismAnimationRef.current?.kill()

    particlesRef.current.forEach((particle) => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          particle.parentNode?.removeChild(particle)
        },
      })
    })
    particlesRef.current = []
  }, [])

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return
    if (!particlesInitialized.current) {
      initializeParticles()
    }

    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return

        const clone = particle.cloneNode(true)
        cardRef.current.appendChild(clone)
        particlesRef.current.push(clone)

        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' })

        gsap.to(clone, {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        })

        gsap.to(clone, {
          opacity: 0.3,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true,
        })
      }, index * 100)

      timeoutsRef.current.push(timeoutId)
    })
  }, [initializeParticles])

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return
    const element = cardRef.current

    const handleMouseEnter = () => {
      isHoveredRef.current = true
      animateParticles()

      if (enableTilt) {
        gsap.to(element, {
          rotateX: 5,
          rotateY: 5,
          duration: 0.3,
          ease: 'power2.out',
          transformPerspective: 1000,
        })
      }
    }

    const handleMouseLeave = () => {
      isHoveredRef.current = false
      clearAllParticles()

      if (enableTilt) {
        gsap.to(element, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' })
      }
      if (enableMagnetism) {
        gsap.to(element, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' })
      }
    }

    const handleMouseMove = (e) => {
      if (!enableTilt && !enableMagnetism) return

      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      if (enableTilt) {
        const rotateX = ((y - centerY) / centerY) * -10
        const rotateY = ((x - centerX) / centerX) * 10
        gsap.to(element, { rotateX, rotateY, duration: 0.1, ease: 'power2.out', transformPerspective: 1000 })
      }

      if (enableMagnetism) {
        const magnetX = (x - centerX) * 0.05
        const magnetY = (y - centerY) * 0.05
        magnetismAnimationRef.current = gsap.to(element, { x: magnetX, y: magnetY, duration: 0.3, ease: 'power2.out' })
      }
    }

    const handleClick = (e) => {
      if (!clickEffect) return

      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height)
      )

      const ripple = document.createElement('div')
      ripple.style.cssText = `
        position: absolute;
        width: ${maxDistance * 2}px;
        height: ${maxDistance * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.4) 0%, rgba(${glowColor}, 0.2) 30%, transparent 70%);
        left: ${x - maxDistance}px;
        top: ${y - maxDistance}px;
        pointer-events: none;
        z-index: 1000;
      `

      element.appendChild(ripple)

      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 1 },
        { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ripple.remove() }
      )
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('click', handleClick)

    return () => {
      isHoveredRef.current = false
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('click', handleClick)
      clearAllParticles()
    }
  }, [animateParticles, clearAllParticles, disableAnimations, enableTilt, enableMagnetism, clickEffect, glowColor])

  return (
    <div
      ref={cardRef}
      className={`${className} particle-container`}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
    >
      {children}
    </div>
  )
}

const GlobalSpotlight = ({
  gridRef,
  disableAnimations = false,
  enabled = true,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor,
}) => {
  const spotlightRef = useRef(null)
  const isInsideSection = useRef(false)

  useEffect(() => {
    if (disableAnimations || !gridRef?.current || !enabled) return

    const spotlight = document.createElement('div')
    spotlight.className = 'global-spotlight'
    /* z-index 与 mix-blend-mode 都放在 MagicBento.css 里统一管理，
       这里只留几何与配色 —— 便于把「不遮挡 dock/弹窗」这条约束集中在一处审查。 */
    spotlight.style.cssText = `
      position: fixed;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.15) 0%,
        rgba(${glowColor}, 0.08) 15%,
        rgba(${glowColor}, 0.04) 25%,
        rgba(${glowColor}, 0.02) 40%,
        rgba(${glowColor}, 0.01) 65%,
        transparent 70%
      );
      opacity: 0;
      transform: translate(-50%, -50%);
    `
    document.body.appendChild(spotlight)
    spotlightRef.current = spotlight

    const handleMouseMove = (e) => {
      if (!spotlightRef.current || !gridRef.current) return

      const section = gridRef.current.closest('.bento-section')
      const rect = section?.getBoundingClientRect()
      const mouseInside =
        rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom

      isInsideSection.current = mouseInside || false
      const cards = gridRef.current.querySelectorAll('.magic-bento-card')

      // 鼠标移出数据卡区域：聚光淡出，并且**把所有卡的辉光强度归零**
      if (!mouseInside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' })
        cards.forEach((card) => {
          card.style.setProperty('--glow-intensity', '0')
        })
        return
      }

      const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius)
      let minDistance = Infinity

      cards.forEach((card) => {
        const cardElement = card
        const cardRect = cardElement.getBoundingClientRect()
        const centerX = cardRect.left + cardRect.width / 2
        const centerY = cardRect.top + cardRect.height / 2
        const distance =
          Math.hypot(e.clientX - centerX, e.clientY - centerY) - Math.max(cardRect.width, cardRect.height) / 2
        const effectiveDistance = Math.max(0, distance)

        minDistance = Math.min(minDistance, effectiveDistance)

        let glowIntensity = 0
        if (effectiveDistance <= proximity) {
          glowIntensity = 1
        } else if (effectiveDistance <= fadeDistance) {
          glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity)
        }

        updateCardGlowProperties(cardElement, e.clientX, e.clientY, glowIntensity, spotlightRadius)
      })

      gsap.to(spotlightRef.current, { left: e.clientX, top: e.clientY, duration: 0.1, ease: 'power2.out' })

      const targetOpacity =
        minDistance <= proximity
          ? 0.8
          : minDistance <= fadeDistance
            ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.8
            : 0

      gsap.to(spotlightRef.current, {
        opacity: targetOpacity,
        duration: targetOpacity > 0 ? 0.2 : 0.5,
        ease: 'power2.out',
      })
    }

    const handleMouseLeave = () => {
      isInsideSection.current = false
      gridRef.current?.querySelectorAll('.magic-bento-card').forEach((card) => {
        card.style.setProperty('--glow-intensity', '0')
      })
      if (spotlightRef.current) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      spotlightRef.current?.parentNode?.removeChild(spotlightRef.current)
    }
  }, [gridRef, disableAnimations, enabled, spotlightRadius, glowColor])

  return null
}

const BentoCardGrid = ({ children, gridRef, className = '', gridProps }) => (
  <div className={`magic-bento-grid bento-section ${className}`} ref={gridRef} {...gridProps}>
    {children}
  </div>
)

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

const MagicBento = ({
  items = [],
  renderItem,
  textAutoHide = false,
  enableStars = false,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor,
  clickEffect = true,
  enableMagnetism = false,
  gridClassName = '',
  gridProps,
}) => {
  const gridRef = useRef(null)
  const isMobile = useMobileDetection()
  const shouldDisableAnimations = disableAnimations || isMobile
  const glowRgb = useMemo(() => glowColor || readThemeGoldRgb(), [glowColor])

  const baseClassName = [
    'magic-bento-card',
    textAutoHide ? 'magic-bento-card--text-autohide' : '',
    enableBorderGlow ? 'magic-bento-card--border-glow' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const renderContent = (item, index) =>
    renderItem ? (
      renderItem(item, index)
    ) : (
      <>
        <div className="magic-bento-card__header">
          <div className="magic-bento-card__label">{item.label}</div>
        </div>
        <div className="magic-bento-card__content">
          <h2 className="magic-bento-card__title">{item.title}</h2>
          <p className="magic-bento-card__description">{item.description}</p>
        </div>
      </>
    )

  return (
    <>
      {enableSpotlight && (
        <GlobalSpotlight
          gridRef={gridRef}
          disableAnimations={shouldDisableAnimations}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowRgb}
        />
      )}

      <BentoCardGrid
        gridRef={gridRef}
        className={gridClassName}
        gridProps={{ ...gridProps, style: { ...(gridProps?.style || {}), '--glow-rgb': glowRgb } }}
      >
        {items.map((item, index) => {
          const cardProps = { className: baseClassName, style: { '--glow-rgb': glowRgb } }

          if (enableStars) {
            return (
              <ParticleCard
                key={index}
                {...cardProps}
                disableAnimations={shouldDisableAnimations}
                particleCount={particleCount}
                glowColor={glowRgb}
                enableTilt={enableTilt}
                clickEffect={clickEffect}
                enableMagnetism={enableMagnetism}
              >
                {renderContent(item, index)}
              </ParticleCard>
            )
          }

          return (
            <div
              key={index}
              {...cardProps}
              ref={(el) => {
                if (!el) return

                const handleMouseMove = (e) => {
                  if (shouldDisableAnimations) return
                  const rect = el.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const y = e.clientY - rect.top
                  const centerX = rect.width / 2
                  const centerY = rect.height / 2

                  if (enableTilt) {
                    const rotateX = ((y - centerY) / centerY) * -10
                    const rotateY = ((x - centerX) / centerX) * 10
                    gsap.to(el, { rotateX, rotateY, duration: 0.1, ease: 'power2.out', transformPerspective: 1000 })
                  }

                  if (enableMagnetism) {
                    const magnetX = (x - centerX) * 0.05
                    const magnetY = (y - centerY) * 0.05
                    gsap.to(el, { x: magnetX, y: magnetY, duration: 0.3, ease: 'power2.out' })
                  }
                }

                const handleMouseLeave = () => {
                  if (shouldDisableAnimations) return
                  if (enableTilt) {
                    gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' })
                  }
                  if (enableMagnetism) {
                    gsap.to(el, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' })
                  }
                }

                const handleClick = (e) => {
                  if (!clickEffect || shouldDisableAnimations) return

                  const rect = el.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const y = e.clientY - rect.top

                  const maxDistance = Math.max(
                    Math.hypot(x, y),
                    Math.hypot(x - rect.width, y),
                    Math.hypot(x, y - rect.height),
                    Math.hypot(x - rect.width, y - rect.height)
                  )

                  const ripple = document.createElement('div')
                  ripple.style.cssText = `
                    position: absolute;
                    width: ${maxDistance * 2}px;
                    height: ${maxDistance * 2}px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(${glowRgb}, 0.4) 0%, rgba(${glowRgb}, 0.2) 30%, transparent 70%);
                    left: ${x - maxDistance}px;
                    top: ${y - maxDistance}px;
                    pointer-events: none;
                    z-index: 1000;
                  `

                  el.appendChild(ripple)

                  gsap.fromTo(
                    ripple,
                    { scale: 0, opacity: 1 },
                    { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ripple.remove() }
                  )
                }

                el.addEventListener('mousemove', handleMouseMove)
                el.addEventListener('mouseleave', handleMouseLeave)
                el.addEventListener('click', handleClick)
              }}
            >
              {renderContent(item, index)}
            </div>
          )
        })}
      </BentoCardGrid>
    </>
  )
}

export default MagicBento
