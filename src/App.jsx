import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Profile from './components/Profile'
import TianxuanSection from './components/TianxuanSection'
import ZhengshenSection from './components/ZhengshenSection'
import WujianSection from './components/WujianSection'
import ContactSection from './components/ContactSection'

/**
 * App —— 页面总装配
 * 从上到下：导航 → 首屏 → 档案 → 天选之人 → 征神之路 → 无间镖客 → 收尾
 * 每个版块的顺序想调整，直接挪下面这五行位置即可。
 */
export default function App() {
  return (
    <div className="site">
      <Navbar />
      <main>
        <Hero />
        <Profile />
        <TianxuanSection />
        <ZhengshenSection />
        <WujianSection />
        <ContactSection />
      </main>
    </div>
  )
}