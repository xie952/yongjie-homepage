/**
 * ModeSection —— 版块外壳
 * 每个大版块统一的容器：两侧装饰线 + 中文大标题 + 英文副题 + 内容。
 * 用法：
 *   <ModeSection id="tianxuan" no="02" title="天选之人" en="TIANXUAN" lead="简介文字">
 *     ...内容...
 *   </ModeSection>
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
            <span className="mode-title-cn">{title}</span>
            <span className="mode-title-en">{en}</span>
          </h2>
          {lead && <p className="mode-lead">{lead}</p>}
        </header>
        <div className="mode-body">{children}</div>
      </div>
    </section>
  )
}