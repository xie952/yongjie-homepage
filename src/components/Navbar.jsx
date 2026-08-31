/**
 * Navbar —— 顶部固定导航
 * 5 个锚点：档案 / 天选之人 / 征神之路 / 无间镖客 / 联系
 * 点击后平滑滚动到对应版块。
 */
const LINKS = [
  { href: '#profile', label: '档案' },
  { href: '#tianxuan', label: '天选之人' },
  { href: '#zhengshen', label: '征神之路' },
  { href: '#wujian', label: '无间镖客' },
  { href: '#contact', label: '联系' }
]

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="主导航">
      <div className="container navbar-inner">
        <a className="navbar-logo" href="#top">
          <span className="navbar-logo-mark" aria-hidden="true">刃</span>
          <span className="navbar-logo-text">永劫 · 个人主页</span>
        </a>
        <ul className="navbar-links">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="navbar-link">{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}