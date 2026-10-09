import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ════════════════════════════════════════════════════════════
 * 版块滚动驱动层（segments.js）
 * ------------------------------------------------------------
 * 实测背景（改前）：全站 31 个 ScrollTrigger 里只有 1 个是 scrub（顶部 2px 进度条），
 *   #profile 及以下 4 个版块的「滚动驱动元素数」= 0 —— 滚动过程本身不产生画面变化，
 *   观感就是「到点播一次，其余时间静止」。
 * 做法（最小面、零新依赖）：每个版块一个 scrub ScrollTrigger，驱动两个合成层属性：
 *   ① .seg-aura  氛围层：随该段进度位移 44px 并提亮（进场 → 中段最亮 → 归位）
 *   ② .mode-head / .closing-head  标题块 ±13px 微视差
 * 遵守站内铁律：
 *   · 只写 transform / opacity（合成层属性，不触发 layout / paint）
 *   · 不把 ScrollTrigger 绑在 sticky 元素上：触发元素是版块 <section> 自身，均非 sticky
 *   · 与 choreo / fx 零重叠：.mode-head 自身不被任何系统写 transform（它们只动子元素）
 *   · reduced-motion 直接跳过：不注入氛围层、不建 ST，CSS 兜底值即静态中性位
 *   · 在统一启动序列第 ④ 步内调用（定位完成、入场系统创建），随后由 App 统一 refresh
 * ════════════════════════════════════════════════════════════ */

const SECTION_IDS = ['profile', 'tianxuan', 'zhengshen', 'wujian', 'contact']
const HEAD_SELECTOR = '.mode-head, .closing-head'
const SCRUB = 0.6        // 平滑跟随（gsap-scrolltrigger：小 scrub 值可降低滚动期负载）

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function initSegments() {
  if (reduce()) return () => {}

  const cleanups = []

  SECTION_IDS.forEach((id) => {
    const section = document.getElementById(id)
    if (!section) return

    // ① 氛围层：每段注入一枚（choreo 注入 .profile-ink-rule 是站内同一手法，不扩 React 结构）
    let aura = section.querySelector(':scope > .seg-aura')
    if (!aura) {
      aura = document.createElement('span')
      aura.className = 'seg-aura'
      aura.setAttribute('aria-hidden', 'true')
      section.prepend(aura)
      cleanups.push(() => aura.remove())
    }

    const triggerVars = { trigger: section, start: 'top bottom', end: 'bottom top', scrub: SCRUB }
    const auraTween = gsap.fromTo(aura,
      { y: 44, opacity: 0.42, scale: 1.04 },
      { y: 0, opacity: 1, scale: 1, ease: 'none', scrollTrigger: triggerVars })

    // ② 标题块微视差：同一段进度、反向 26px 行程（与氛围层同一个 scrub 节奏）
    const head = section.querySelector(HEAD_SELECTOR)
    const headTween = head
      ? gsap.fromTo(head, { y: -13 },
          { y: 13, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: SCRUB } })
      : null

    cleanups.push(() => {
      if (auraTween.scrollTrigger) auraTween.scrollTrigger.kill()
      auraTween.kill()
      if (headTween) {
        if (headTween.scrollTrigger) headTween.scrollTrigger.kill()
        headTween.kill()
      }
      if (head) gsap.set(head, { clearProps: 'transform' })
    })
  })

  return () => cleanups.forEach((fn) => fn())
}
