/**
 * ModeSection —— 版块外壳
 * 标题区（编号 + 主标题 + 英文副题 + lead 简介）。
 * 动效由 GSAP 驱动：标题文字 data-split 逐字升起，lead 段落 data-reveal 整块淡入。
 */
export default function ModeSection({ id, no, title, en, lead, children }) {
  return (
    <section className="mode-section" id={id}>
      <div className="container">
        <header className="mode-head">
          <div className="mode-head-top">
            <span className="mode-no">{no}</span>
            <span className="mode-rule" aria-hidden="true" />
          </div>
          <h2 className="mode-title">
            <span className="mode-title-cn" data-split>{title}</span>
            <span className="mode-title-en" data-split>{en}</span>
          </h2>
          {lead && <p className="mode-lead" data-reveal="up">{lead}</p>}
        </header>
        <div className="mode-body">{children}</div>
      </div>
    </section>
  )
}