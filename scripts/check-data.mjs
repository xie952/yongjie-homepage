/**
 * 数据闸门（数据自检）
 * ---------------------------------------------------------------
 * 目的：把交接文档 §7「铁律」里靠人记的几条，变成一条可执行的命令。
 * 为什么现在做：文档 §3 的待完成项 ③④⑤ 全是「等用户补数据」——
 *   等分境截图进来、等联系方式确认、等英雄印数补齐。补数据那一刻，
 *   最容易犯的就是文档已记录过的坑（D4 三境抄同一份、D12 素材大小写）。
 *   所以先把这个守门人建好：数据一改，`npm run check:data` 立刻报出来。
 *
 * 检查项（全部只读，不改任何文件）：
 *   1. 素材路径必须在 public/ 下**按真实大小写**存在（Windows 不区分大小写，
 *      GitHub Pages 区分 → 本地好好的，上线 404。对应文档 §13.4 D12）
 *   2. 品质档位 rarity 必须在数据约定档位内（文档 §7：档位以 data-rarity 为准）
 *   3. labelTheme:true 的条目，所属卡片必须有主题色（否则标签字色会静默落空）
 *   4. 生存类时间字段必须是**秒数**或 null（文档 §7：时间存秒；"23:09" 这类字符串是坑）
 *   5. 三境同名指标不得出现「三份完全相同的非空值」（文档 §7：三境场次禁止三份相同；
 *      D4 就是这么翻的车）——分境没拿到就写 null，宁缺勿假
 *   6. wujian.totals 必须是数字（汇总口径单独放，不许抄进分境）
 *   7. lastUpdated 必须是 YYYY-MM-DD
 *   8. 联系方式若仍是占位值 → 提醒（WARN，不算错）
 *
 * 用法：node scripts/check-data.mjs
 *      退出码 0 = 全部通过（可能有 WARN）；1 = 有 FAIL，别急着 build
 */
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'
import * as data from '../src/data/stats.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = join(ROOT, 'public')

const fails = []
const warns = []
const oks = []

const fail = (msg) => fails.push(msg)
const warn = (msg) => warns.push(msg)
const ok = (msg) => oks.push(msg)

/* ── 0. public/ 真实文件名清单（保留大小写），供素材路径校验 ── */
function listPublicFiles() {
  const out = []
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name)
      if (ent.isDirectory()) walk(abs)
      else out.push(relative(PUBLIC_DIR, abs).split(sep).join('/'))
    }
  }
  if (existsSync(PUBLIC_DIR)) walk(PUBLIC_DIR)
  return out
}
const PUBLIC_FILES = listPublicFiles()
const PUBLIC_SET = new Set(PUBLIC_FILES)
// 小写索引 → 用来识别「内容在、但大小写写错了」这种最隐蔽的 404
const PUBLIC_LOWER = new Map()
PUBLIC_FILES.forEach((f) => PUBLIC_LOWER.set(f.toLowerCase(), f))

/** 校验一个 public 内素材路径（stats.js 里的写法是 "/xxx.PNG"） */
function checkAsset(pathValue, where) {
  if (pathValue == null || pathValue === '') return           // null = 有意留空，不算错
  if (typeof pathValue !== 'string') return fail(`${where}：素材路径必须是字符串或 null，实际 ${typeof pathValue}`)
  if (!pathValue.startsWith('/')) return fail(`${where}：素材路径必须以 / 开头（现在 "${pathValue}"）`)
  if (/^https?:\/\//i.test(pathValue)) return                 // 外链不校验
  const rel = pathValue.replace(/^\/+/, '')
  if (PUBLIC_SET.has(rel)) return
  const lowerHit = PUBLIC_LOWER.get(rel.toLowerCase())
  if (lowerHit) {
    fail(`${where}：大小写不匹配 —— 数据写 "/${rel}"，磁盘上是 "/${lowerHit}"。`
      + '本地 Windows 不区分大小写看不出问题，部署到 GitHub Pages 会直接 404（文档 §13.4 D12）')
  } else {
    fail(`${where}：public/ 下没有这个文件 —— "${pathValue}"`)
  }
}

/* ── 1. 玩家档案 ── */
const { player, tianxuan, zhengshen, wujian, closing, weaponTheme, treasureTheme } = data

checkAsset(player.heroPortrait, 'player.heroPortrait')
checkAsset(player.artPortrait, 'player.artPortrait')
checkAsset(player.titleLogo, 'player.titleLogo')
checkAsset(player.avatar, 'player.avatar')
player.favHeroes.forEach((h, i) => checkAsset(h.avatar, `player.favHeroes[${i}](${h.name}).avatar`))
player.favWeapons.forEach((w, i) => checkAsset(w.media, `player.favWeapons[${i}](${w.name}).media`))
if (!player.favHeroes.length) warn('player.favHeroes 为空：档案区常用英雄会整块消失')
if (player.artPortrait == null) warn('player.artPortrait 仍为 null：Hero 立绘层是空占位（文档 §5 已知限制，等立绘图）')

/* ── 2. 天选之人 ── */
const RARITY_OK = new Set(['common', 'rare', 'epic', 'legendary'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function checkDate(v, where) {
  if (v == null) return warn(`${where} 为 null：页脚「更新于」会缺数据`)
  if (typeof v !== 'string' || !DATE_RE.test(v)) fail(`${where} 必须是 YYYY-MM-DD 字符串（现在 ${JSON.stringify(v)}）`)
}

checkDate(tianxuan.lastUpdated, 'tianxuan.lastUpdated')

// 14 项指标：时间类的必须是秒数
const TIME_KEYS = new Set(['maxSurvival', 'avgSurvival'])
const NUM_OR_NULL = /^(matches|wins|winRate|top5|kills|avgDamage|maxKills|kd|maxSurvival|avgSurvival|maxMoveDist|avgMoveDist|avgRevives|avgHeal|score)$/
Object.entries(tianxuan.modes).forEach(([mode, m]) => {
  Object.entries(m).forEach(([key, val]) => {
    if (!NUM_OR_NULL.test(key)) return
    if (val == null) return
    if (typeof val !== 'number' || Number.isNaN(val)) {
      return fail(`tianxuan.modes.${mode}.${key} 必须是数字或 null（现在 ${JSON.stringify(val)}）`)
    }
    if (TIME_KEYS.has(key) && val > 7200) {
      warn(`tianxuan.modes.${mode}.${key}=${val} 秒（>2h）—— 确认单位是秒，不是毫秒（文档 §7：时间存秒）`)
    }
  })
  checkAsset(m.rankCrest, `tianxuan.modes.${mode}.rankCrest`)
})

// 英雄 / 武器
const heroNames = new Set(tianxuan.heroes.map((h) => h.name))
tianxuan.heroes.forEach((h, i) => {
  const where = `tianxuan.heroes[${i}](${h.name})`
  if (!h.themeColor) fail(`${where}.themeColor 缺失：卡片主题色只能从数据走（文档 §7），没有它会退回品质色`)
  checkAsset(h.avatar, `${where}.avatar`)
  h.skins?.forEach((s, j) => {
    if (!RARITY_OK.has(s.rarity)) fail(`${where}.skins[${j}].rarity=${JSON.stringify(s.rarity)} 不在档位白名单 ${[...RARITY_OK].join('/')}`)
    if (s.labelTheme && !h.themeColor) fail(`${where}.skins[${j}] 写了 labelTheme:true，但该卡没有 themeColor`)
    checkAsset(s.imageUrl, `${where}.skins[${j}](${s.name}).imageUrl`)
  })
})
tianxuan.weapons.forEach((w, i) => {
  const where = `tianxuan.weapons[${i}](${w.name})`
  checkAsset(w.image, `${where}.image`)
  w.skins?.forEach((s, j) => {
    if (!RARITY_OK.has(s.rarity)) fail(`${where}.skins[${j}].rarity=${JSON.stringify(s.rarity)} 不在档位白名单`)
    // 武器卡的 labelTheme 读 weaponTheme（派生自英雄卡的金），派生链在这里校验收口
    if (s.labelTheme && !weaponTheme?.hex) fail(`${where}.skins[${j}] 写了 labelTheme:true，但 weaponTheme.hex 为空（英雄卡主题金取不到）`)
    checkAsset(s.imageUrl, `${where}.skins[${j}](${s.name}).imageUrl`)
  })
})
if (weaponTheme?.hex && !hexOk(weaponTheme.hex)) fail(`weaponTheme.hex=${weaponTheme.hex} 不是合法 #RRGGBB`)
if (treasureTheme?.hex && !hexOk(treasureTheme.hex)) fail(`treasureTheme.hex=${treasureTheme.hex} 不是合法 #RRGGBB`)
if (treasureTheme && !treasureTheme.hex) warn('treasureTheme.hex 为空：藏品卡会走 CSS 回退色（沈妙卡被改名/删掉时会这样）')

function hexOk(hex) {
  return /^#[0-9a-f]{6}$/i.test(String(hex))
}

/* ── 3. 征神之路 ── */
checkDate(zhengshen.lastUpdated, 'zhengshen.lastUpdated')
if (typeof zhengshen.level !== 'number') fail(`zhengshen.level 必须是数字（现在 ${JSON.stringify(zhengshen.level)}）`)
if (typeof zhengshen.matches !== 'number') fail(`zhengshen.matches 必须是数字（现在 ${JSON.stringify(zhengshen.matches)}）`)
if (zhengshen.seals == null || zhengshen.achievements == null) {
  warn('zhengshen.seals / achievements 有空值：这两项截图里没有，等用户补（文档 §3 待完成 ③）')
}
zhengshen.heroBuilds.forEach((b, i) => {
  const where = `zhengshen.heroBuilds[${i}](${b.name})`
  checkAsset(b.avatar, `${where}.avatar`)
  checkAsset(b.detailImg, `${where}.detailImg`)
  if (b.detailImg == null) warn(`${where}.detailImg 为 null：弹窗会显示「详细图待补充」占位`)
  if (!Array.isArray(b.jades) || !b.jades.length) warn(`${where}.jades 为空数组：魂玉行会空着`)
})

/* ── 4. 无间镖客：分境口径（文档 §7 铁律「三境场次禁止三份相同」） ── */
checkDate(wujian.lastUpdated, 'wujian.lastUpdated')

if (!wujian.totals || typeof wujian.totals !== 'object') {
  fail('wujian.totals 缺失：三境汇总口径必须单独放（文档 §7，D4 的修复方案）')
} else {
  Object.entries(wujian.totals).forEach(([k, v]) => {
    if (typeof v !== 'number') fail(`wujian.totals.${k} 必须是数字（汇总口径不能留 null）`)
  })
}

const MODE_KEYS = ['shengjing', 'xianjing', 'jiejing']
const MODE_LABEL = { shengjing: '生境', xianjing: '险境', jiejing: '劫境' }
if (!MODE_KEYS.every((k) => wujian.modes?.[k])) {
  fail(`wujian.modes 必须同时有 ${MODE_KEYS.join(' / ')} 三个境`)
} else {
  // 逐字段比较：三境同名的**非空**值如果完全一样 → 铁律违规
  const fields = new Set()
  MODE_KEYS.forEach((k) => Object.keys(wujian.modes[k]).forEach((f) => fields.add(f)))
  let identicalTriples = 0
  fields.forEach((f) => {
    const vals = MODE_KEYS.map((k) => wujian.modes[k][f])
    const allFilled = vals.every((v) => v != null)
    if (!allFilled) return
    const same = vals.every((v) => v === vals[0])
    if (same) {
      identicalTriples += 1
      fail(`wujian.modes.*.${f} 三个境完全相同（都是 ${JSON.stringify(vals[0])}）——`
        + '违反「三境禁止三份相同」铁律（文档 §7 / D4）。分境没拿到就写 null，汇总值放 wujian.totals')
    }
  })
  if (!identicalTriples) ok('三境分境字段无「三份完全相同」情况')

  // 进度提示：还有哪些字段在等截图
  const pending = []
  fields.forEach((f) => {
    const nulls = MODE_KEYS.filter((k) => wujian.modes[k][f] == null).length
    if (nulls) pending.push(`${f}(${nulls}/3 空)`)
  })
  if (pending.length) {
    warn(`分境仍有待补字段（卡片显示「—」）：${pending.join('、')} —— 文档 §3 待完成 ④`)
  } else {
    ok('分境字段已补齐')
  }
}

wujian.treasures?.forEach((t, i) => {
  const where = `wujian.treasures[${i}](${t.name})`
  if (!RARITY_OK.has(t.rarity)) fail(`${where}.rarity=${JSON.stringify(t.rarity)} 不在档位白名单`)
  checkAsset(t.imageUrl, `${where}.imageUrl`)
})

/* ── 5. 收尾页联系方式（占位值提醒） ── */
const PLACEHOLDERS = ['yunji_xue', 'QingFeng#8864', '你的微信', '待替换']
Object.entries(closing?.contact || {}).forEach(([k, v]) => {
  if (v == null || v === '') return warn(`closing.contact.${k} 为空：收尾页会少一条联系方式`)
  if (PLACEHOLDERS.includes(v)) warn(`closing.contact.${k} 仍是占位值「${v}」—— 等用户确认真实值（文档 §13.4 D10）`)
})

/* ── 索引一致性：文档 §14.10 铁律「卡片判定必须用 isStatCell()」之类是代码层约定，此处不查 ── */
if (!heroNames.size) fail('tianxuan.heroes 为空')

/* ── 输出 ── */
const line = '─'.repeat(64)
console.log(line)
console.log('数据自检 · yongjie-homepage')
console.log(line)
if (oks.length) {
  console.log('\n✅ 通过：')
  oks.forEach((m) => console.log('   · ' + m))
}
if (warns.length) {
  console.log('\n⚠️  提醒（不算错，但交接文档里多半已记着）：')
  warns.forEach((m) => console.log('   · ' + m))
}
if (fails.length) {
  console.log('\n❌ 失败：')
  fails.forEach((m) => console.log('   · ' + m))
}
console.log('\n' + line)
console.log(`结果：${fails.length} 个错误 / ${warns.length} 个提醒`)
console.log(line)

process.exit(fails.length ? 1 : 0)
