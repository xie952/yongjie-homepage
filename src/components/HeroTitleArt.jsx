import { player } from '../data/stats'

/* ════════════════════════════════════════════════════════════
 * HeroTitleArt —— 首屏大标题「图片样式」（水墨笔触 + 朱红印章）
 * ------------------------------------------------------------
 * 为什么用内联 SVG 而不是 <img src="...png">：
 *   1. 纯矢量、任意缩放不糊；体积极小、无二进制资源
 *   2. 印章里的落款取自 stats.js 的 player.id —— 换 ID 自动跟着变，
 *      不会出现"图片里还写着旧名字"的尴尬
 *   3. 每个字是独立 <text> 节点（.hero-char），fx.js 的首屏时间轴
 *      仍能逐字做墨迹显形；印章是独立 <g id="hero-ink-seal">，
 *      仍能做"盖章"落印动效 —— 动画钩子与改造前完全兼容
 *   4. 遵循项目铁律：不使用官方素材，全部为自绘矢量
 *
 * 如果以后想换成自己的图片：在 stats.js 里把 player.titleLogo 填成
 * "/文件名.png" 即可（会整体替换本组件，动画自动降级为整幅淡入）。
 * ════════════════════════════════════════════════════════════ */

const TITLE = '永劫无间'

/* ── 版面常量（想再调间距/大小只动这里）──
   BOX_W        画布宽度；四个字以 BOX_W/2 为几何中心排布，
                所以"图片元素居中"就等于"四个字居中在整个 Hero"
   GLYPH_SPACING 字心间距：210 → 176 → 192
                 （换华文行楷后其笔画明显比楷体宽，176 时相邻字墨迹会粘连；
                  按行楷墨迹宽度回调到 192 —— 只此一处为字体替换做的必要补偿）
   GLYPH_SIZE    字号；GLYPH_CY 字心纵向位置
   印章贴在末字右侧（不再压住「间」字），仍被同一个居中盒容纳 */
const BOX_W = 1000
const GLYPH_SPACING = 192
const GLYPH_SIZE = 188
const GLYPH_CY = 132
const SEAL_SIZE = 58        // 印章整体比例（92 → 68 → 58，内部文字/内框/偏移自动同比缩放）
const SEAL_GAP = -4         // 印章与末字「间」的间距（20 → 8 → -4：贴住字形盒边缘，
                            //   视觉上几乎贴着「间」的墨迹，但不重叠）
const charX = (i) => BOX_W / 2 + (i - (TITLE.length - 1) / 2) * GLYPH_SPACING
const SEAL_X = Math.round(charX(TITLE.length - 1) + GLYPH_SIZE / 2 + SEAL_GAP)
const SEAL_CX = SEAL_X + SEAL_SIZE / 2
// 印章纵向位置：贴向「间」字的右下（原 +6 为与字心齐平；+0.34 字高 ≈ 落到字形下半部）
const SEAL_CY = GLYPH_CY + Math.round(GLYPH_SIZE * 0.34)
/* 印章内部元素按 SEAL_SIZE 等比推导 —— 改大小不用逐个手调 */
const SEAL_INSET = Math.round(SEAL_SIZE * 0.087)   // 内框内缩（92→8 / 68→6）
const SEAL_TEXT_SIZE = Math.round(SEAL_SIZE * 0.39) // 落款字号（92→36 / 68→27）
const SEAL_DX = Math.round(SEAL_SIZE * 0.098)       // 落款左右错开
const SEAL_DY = Math.round(SEAL_SIZE * 0.22)        // 落款上下错开
const SEAL_STROKE = +(SEAL_SIZE / 46).toFixed(1)    // 内框线宽

/* 每个字的手绘感微调：轻微旋转 + 上下错落（模拟蘸墨落笔的呼吸） */
const CHAR_TWEAKS = [
  { dx: 0, dy: 4, rot: -1.6 },
  { dx: 0, dy: -5, rot: 1.2 },
  { dx: 0, dy: 3, rot: -0.8 },
  { dx: 0, dy: -3, rot: 1.8 },
]

export default function HeroTitleArt({ className = '' }) {
  const chars = Array.from(TITLE)
  const sealText = Array.from(player.id || '榭安').slice(0, 2)

  return (
    <svg
      className={'hero-title-art ' + className}
      viewBox="0 26 1000 214"   /* 纵向收紧：裁掉字形上下的空白带，副标题与标题的间距才由 CSS 精确控制 */
      role="img"
      aria-label={TITLE}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* 墨色：上浓下淡（干笔飞白），两端可被 CSS 变量覆盖 */}
        <linearGradient id="htaInk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hero-ink-a, #ffffff)" />
          <stop offset="58%" stopColor="var(--hero-ink-b, #efe9dc)" />
          <stop offset="100%" stopColor="var(--hero-ink-c, #c9c2b4)" />
        </linearGradient>
        {/* 笔触毛边：湍流位移，让笔画边缘呈现宣纸上的涩感 */}
        <filter id="htaBrush" x="-8%" y="-14%" width="116%" height="128%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028 0.07" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
        {/* 印章：更细的颗粒毛边 + 轻微晕染 */}
        <filter id="htaSeal" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      {/* —— 四个字：各自独立节点，逐字入场由 fx.js 驱动 —— */}
      <g filter="url(#htaBrush)">
        {chars.map((ch, i) => (
          <text
            key={ch + i}
            className="hero-char"
            x={charX(i) + (CHAR_TWEAKS[i]?.dx || 0)}
            y={GLYPH_CY + (CHAR_TWEAKS[i]?.dy || 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={GLYPH_SIZE}
            fontWeight={400}
            fill="url(#htaInk)"
            transform={`rotate(${CHAR_TWEAKS[i]?.rot || 0} ${charX(i)} ${GLYPH_CY})`}
            style={{ fontFamily: 'var(--font-title-logo)' }}   /* 华文行楷（CSS 引用，不自托管） */
          >
            {ch}
          </text>
        ))}
      </g>

      {/* —— 朱红印章（落款 = 玩家 ID，自动跟随 stats.js）——
          结构约定：外层 <g> 只把坐标系平移到印章中心（不做任何动画），
          内层 #hero-ink-seal 以"自身中心 = 局部原点"绘制并承担旋转/缩放动画。
          这样 GSAP 默认写入的 transform-origin: 0px 0px 恰好就是印章中心，
          不会出现"绕画布原点旋转 → 印章整体下移约 41px"的问题（已实测踩过）。 */}
      <g transform={`translate(${SEAL_CX} ${SEAL_CY})`}>
        <g id="hero-ink-seal" aria-hidden="true">
          <g filter="url(#htaSeal)">
            <rect x={-SEAL_SIZE / 2} y={-SEAL_SIZE / 2} width={SEAL_SIZE} height={SEAL_SIZE} rx={Math.round(SEAL_SIZE * 0.11)} fill="#A6362B" />
            <rect
              x={-SEAL_SIZE / 2 + SEAL_INSET} y={-SEAL_SIZE / 2 + SEAL_INSET}
              width={SEAL_SIZE - SEAL_INSET * 2} height={SEAL_SIZE - SEAL_INSET * 2}
              rx={Math.round(SEAL_SIZE * 0.065)} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={SEAL_STROKE}
            />
            {sealText.map((ch, i) => (
              <text
                key={ch + i}
                x={i === 0 ? -SEAL_DX : SEAL_DX}
                y={sealText.length === 1 ? 0 : (i === 0 ? -SEAL_DY : SEAL_DY + 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={SEAL_TEXT_SIZE}
                fill="#ffffff"
                style={{ fontFamily: 'var(--font-calligraphy)' }}
              >
                {ch}
              </text>
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}
