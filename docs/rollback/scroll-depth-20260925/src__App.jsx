import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Dock from './components/Dock'
import Hero from './components/Hero'
import Profile from './components/Profile'
import TianxuanSection from './components/TianxuanSection'
import ZhengshenSection from './components/ZhengshenSection'
import WujianSection from './components/WujianSection'
import ContactSection from './components/ContactSection'
import initSiteMotion, { initHover, initScrollReveals, initSmoothScroll } from './lib/animations'
import initChoreo from './lib/choreo'
import initFx from './lib/fx'
import initJoins, { computeLanding } from './lib/join'
import initSegments from './lib/segments'
import { effects } from './data/stats'

/**
 * App —— 页面总装配
 * 从上到下：导航 → 首屏 → 档案 → 天选之人 → 征神之路 → 无间镖客 → 收尾
 * 挂载后初始化动效系统：
 *   initSiteMotion()  通用入场/滚动（animations.js）
 *   initChoreo()      四板块(档案/天选/英雄/武器+征神数字排)编排层（先接管，
 *                     摘除旧 data-reveal 标记避免双重动画）
 *   initFx()          区块特效（跳过 choreo 数字，仅处理新挂载面板）
 *   initJoins()       四处交互接缝
 */
export default function App() {
  useLayoutEffect(() => {
    /* ═══════════════════════════════════════════════════════════════
      统一启动序列（定位绘制前完成；重计算与 Lenis 延后到首帧后）
      0. 锁滚动恢复（main.jsx 模块顶层已设，此处兜底）
      1. computeLanding() 决定目标
      2. 原生 window.scrollTo 同步定位（零动画）；Lenis 等 Hero 出场后再接管
         —— 必须在任何入场 ST 创建之前：ST 只会按"最终位置"评估，
             不存在"先经过中途板块把它消费掉"的窗口
      3. 创建全部入场动画系统（choreo / fx / 交互接缝）
      4. 首帧后统一 ScrollTrigger.refresh()；字体就绪后再 refresh/resize 一次
      5. 自检：初始化后 300ms 对比实际位置与目标，偏差 >1 屏输出诊断
      Hero 首屏时间轴是否播放由 fx 读取 __bootLanding 门控（仅目标在顶部时播）
      fonts.ready / poster 加载只控制 Hero 播放时机，绝不阻塞本启动链。
      ═══════════════════════════════════════════════════════════════ */
    // 0 锁定滚动恢复。
    // 注意：GSAP ScrollTrigger 在每次"全量 refresh"结束时，会把它在【模块导入期】
    // 记下的旧值（此处为 'auto'，早于本函数执行）写回 history.scrollRestoration，
    // 于是页面 load 之后又被改回 'auto'。因此在 refresh 之后与浏览器关键事件上再锁一次。
    const lockScrollRestoration = () => {
      if ('scrollRestoration' in history && history.scrollRestoration !== 'manual') {
        history.scrollRestoration = 'manual'
      }
    }
    lockScrollRestoration()
    const LOCK_EVENTS = ['load', 'pageshow', 'resize', 'visibilitychange']
    LOCK_EVENTS.forEach((ev) => window.addEventListener(ev, lockScrollRestoration))

    // main.jsx 已先清理“刷新保留的旧 hash”；这里此时读到的才是本次启动的最终直链 hash。
    const initialHash = window.location.hash

    // 1 先读取 hash 落点：这次布局读取随后会被 Lenis 尺寸测量复用，避免刷新首帧重复强制全页布局
    const landing = computeLanding()
    window.__bootLanding = landing

    // 2 动效系统先启动，但 Lenis 延迟接管：避免构造时读取整页高度阻塞刷新首帧
    initSiteMotion({ createLenis: false, setupInteractions: false })
    window.__lenis = null
    let cleanupLenis = null
    let smoothStarted = false
    let smoothIdle = 0
    let smoothTimer = 0
    let resizeRaf = 0
    const onWindowResize = () => {
      if (resizeRaf) return
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0
        window.__lenis?.resize()
      })
    }
    window.addEventListener('resize', onWindowResize, { passive: true })
    const startSmoothScroll = () => {
      if (smoothStarted) return
      smoothStarted = true
      const createLenis = () => {
        smoothIdle = 0
        const lenis = initSmoothScroll()
        window.__lenis = lenis
        if (lenis) cleanupLenis = () => lenis.destroy()
        ScrollTrigger.refresh()
        lockScrollRestoration()
      }
      if ('requestIdleCallback' in window) smoothIdle = window.requestIdleCallback(createLenis, { timeout: 400 })
      else smoothTimer = window.setTimeout(createLenis, 100)
    }
    let deferredSetupStarted = false
    const deferredTimers = []
    const runDeferredSetup = () => {
      if (deferredSetupStarted) return
      deferredSetupStarted = true
      deferredTimers.push(window.setTimeout(initHover, 120))
      deferredTimers.push(window.setTimeout(initScrollReveals, 320))
    }
    // 守卫队列（Lenis 接管 + 延迟初始化）：开闸条件 = 定位完成 + 加载屏退场动画结束。
    // 加载屏不存在 / reduced-motion 已跳过时，__preloader.done() 直接为 true → 立即开闸。
    const openGuardQueue = () => {
      startSmoothScroll()
      runDeferredSetup()
    }
    const smoothFallback = window.setTimeout(openGuardQueue, 6500)   // 兜底（加载屏最长 5s + 退场 0.9s）
    const onPreloaderDone = () => {
      window.clearTimeout(smoothFallback)
      openGuardQueue()
    }
    if (window.__preloader && window.__preloader.done()) onPreloaderDone()
    else window.addEventListener('preloader-done', onPreloaderDone, { once: true })

    // 3 同步定位（先于 initChoreo/initFx/initJoins 的 ST 创建）
    window.scrollTo(0, landing.y)
    if (initialHash) history.replaceState(null, '', initialHash)
    // 定位已完成 → 此刻才彻底锁滚动（过早锁会挡住上面这行 programmatic scrollTo）
    window.__preloader?.lockScroll?.()

    // 4 入场动画系统（此刻视口已在最终位置）
    const cleanupChoreo = initChoreo()
    const cleanupFx = initFx()
    initJoins()
    // ③ 版块滚动驱动层：每段一个 scrub（氛围层位移 + 标题块微视差）。
    //    放在统一启动序列第 ④ 步 → 按最终落点评估；随后由第 ⑤ 步统一 refresh。
    const cleanupSegments = initSegments()

    // 5 首帧后再统一刷新：定位已完成，避免 refresh 在首次绘制前强制整页布局
    // refresh 会触发 ScrollTrigger 的回写 → 紧随其后再锁一次
    const doRefresh = (resize = false) => requestAnimationFrame(() => {
      if (resize) window.__lenis?.resize()
      ScrollTrigger.refresh()
      lockScrollRestoration()
    })
    doRefresh()
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        doRefresh(true)
      }).catch(() => {})
    }

    // 6 自检（保险层，不自动修复）
    const check = () => {
      setTimeout(() => {
        lockScrollRestoration()
        if (history.scrollRestoration !== 'manual') {
          console.warn('[boot] scrollRestoration 未能锁定为 manual（当前 ' + history.scrollRestoration + '）')
        }
        const d = Math.abs(window.scrollY - landing.y)
        if (d > window.innerHeight) {
          console.warn('[boot] 滚动位置与初始化目标冲突：目标 y=' + landing.y
            + '，实际 y=' + Math.round(window.scrollY) + '（偏差 ' + Math.round(d)
            + 'px > 1 屏 —— 仍有系统在抢滚动位置，未自动修复）')
        }
      }, 300)
    }
    if (document.readyState === 'complete') check()
    else window.addEventListener('load', check, { once: true })

    return () => {
      LOCK_EVENTS.forEach((ev) => window.removeEventListener(ev, lockScrollRestoration))
      window.removeEventListener('preloader-done', onPreloaderDone)
      window.clearTimeout(smoothFallback)
      if (smoothIdle && 'cancelIdleCallback' in window) window.cancelIdleCallback(smoothIdle)
      if (smoothTimer) window.clearTimeout(smoothTimer)
      deferredTimers.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('resize', onWindowResize)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      cleanupSegments?.()
      cleanupFx?.()
      cleanupChoreo?.()
      cleanupLenis?.()
      ScrollTrigger.getAll().forEach((t) => t.kill())
      gsap.globalTimeline.clear()
      window.__lenis = null
    }
  }, [])

  return (
    // data-cover 交给 CSS 决定叠层转场范围：hero=仅首屏被覆盖 / all=全站层层上叠
    <div className="site" data-cover={effects.coverMode === 'all' ? 'all' : 'hero'}>
      {/* 全站唯一导航：macOS 风格悬浮 Dock（CSS 里固定在视口【顶部】居中 top:16px；
          原本的顶部导航栏 Navbar 已移除 —— 别被"顶部/底部"的历史注释误导） */}
      <Dock />
      <main>
        {/* 叠层覆盖对：Hero 与玩家档案同处一个撑高容器。
            Hero 在这段容器内被 sticky 钉住，档案从下方平直盖上来；
            容器滚完后 Hero 随容器一起离开视口，其余板块回到常规滚动
            （不再需要给每个区块抬 z-index，也不会再有"被钉住的 Hero 从透明带透出"） */}
        <div className="cover-pair">
          <Hero />
          <Profile />
        </div>
        <TianxuanSection />
        <ZhengshenSection />
        <WujianSection />
        <ContactSection />
      </main>
    </div>
  )
}
