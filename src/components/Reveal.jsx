/**
 * Reveal —— 已由 GSAP 动效系统接管，本组件退化为"透明透传"。
 * 保留同名导出是为了兼容既有组件 import，不再产生任何隐藏/动画效果，
 * 所有入场动画统一由 src/lib/animations.js（GSAP + ScrollTrigger）驱动。
 */
export function useInView() {
  const ref = { current: null }
  return [ref, true]
}

export default function Reveal({ as: Tag = 'div', children, className = '', ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  )
}

export function RevealGroup({ as: Tag = 'div', children, className = '', ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  )
}