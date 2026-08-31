/**
 * RankBadge —— 段位徽章
 * 内置《永劫无间》11 个段位的配色映射，支持 sm / md / lg 三种尺寸。
 * 用法：<RankBadge rank="陨星" size="md" />
 */
const RANK_MAP = {
  '青铜':     { main: '#a0764a', sub: '#5c4427', edge: '#d4a76a' },
  '白银':     { main: '#9aa7b1', sub: '#4d5a63', edge: '#cdd9e0' },
  '黄金':     { main: '#c9a44d', sub: '#6e5220', edge: '#f0cf7f' },
  '铂金':     { main: '#6fc3df', sub: '#2a5f74', edge: '#b7e8f8' },
  '陨星':     { main: '#8f7bd8', sub: '#3d3164', edge: '#c9bcf0' },
  '蚀月':     { main: '#5b8dd9', sub: '#24406b', edge: '#a8c8f0' },
  '坠日':     { main: '#e07b3a', sub: '#6e3311', edge: '#f8b07f' },
  '无间修罗': { main: '#d83a48', sub: '#641018', edge: '#f0878f' },
  '无双修罗': { main: '#e0526d', sub: '#641018', edge: '#f8a0a8' },
  '无相龙王': { main: '#37c2a4', sub: '#0e5a4b', edge: '#8df0dc' },
  '无量梵天': { main: '#e8e2f5', sub: '#5a5090', edge: '#ffffff' }
}

// 尺寸表：sm(小) / md(中) / lg(大)
const SIZES = {
  sm: { fontSize: 12, pad: '4px 10px', radius: 6, gap: 6, diamond: 10 },
  md: { fontSize: 15, pad: '8px 18px', radius: 9, gap: 10, diamond: 16 },
  lg: { fontSize: 22, pad: '14px 34px', radius: 13, gap: 16, diamond: 26 }
}

export default function RankBadge({ rank, size = 'md' }) {
  const colors = RANK_MAP[rank] || RANK_MAP['青铜']
  const sz = SIZES[size] || SIZES.md

  return (
    <span
      className="rank-badge"
      style={{
        fontSize: sz.fontSize,
        padding: sz.pad,
        borderRadius: sz.radius,
        gap: sz.gap,
        // 主背景 + 顶部高光，营造金属质感
        background: `linear-gradient(180deg, ${colors.main} 0%, ${colors.sub} 100%)`,
        border: `1px solid ${colors.edge}`,
        boxShadow: `0 0 14px ${colors.edge}33, inset 0 1px 0 rgba(255,255,255,.28)`,
        color: '#0d0b09'
      }}
      title={`当前段位：${rank}`}
    >
      {/* 段位菱形象征图形 */}
      <svg
        width={sz.diamond}
        height={sz.diamond}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M12 2 L21 12 L12 22 L3 12 Z"
          fill="rgba(255,255,255,.85)"
          stroke="rgba(0,0,0,.25)"
          strokeWidth="1.2"
        />
      </svg>
      <span className="rank-badge-text">{rank}</span>
    </span>
  )
}