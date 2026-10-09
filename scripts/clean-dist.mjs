/**
 * 构建前清空 dist/（确定性构建）
 * ---------------------------------------------------------------
 * 背景（交接文档 §8.4 / §8.5 记录过）：
 *   Vite 的 `build.emptyOutDir` 在**受限沙箱**里会「静默无效化」——
 *   底层的 fs.rmSync 既不抛错、也不删除，于是旧产物留在 dist/ 里：
 *     · assets/index-<旧hash>.js/css 越堆越多；
 *     · 万一浏览器/服务器缓存了旧 index.html，它引用的旧 hash 文件**还在**，
 *       页面就"看起来改了但其实没生效"（§8.5 那个坑）。
 *   所以这里在 vite build 之前自己删一遍，并且**验证删干净了没有**：
 *   删不掉就报错退出，别让"半新半旧"的 dist/ 上线。
 *
 * 与文档的关系：§8.5 给的手动方案是 `Remove-Item -Recurse -Force dist; npm run build`。
 *   本脚本把这句 PowerShell 变成跨平台的 Node 实现，并挂进 `npm run build`，
 *   于是文档里那条命令照旧有效，且不必再手动执行。
 *
 * 用法：node scripts/clean-dist.mjs（已被 npm run build 自动调用）
 *      退出码 0 = dist 已清空（或本来就不存在）；1 = 没删干净
 */
import { rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

/** 数一数 dist 里还剩多少文件（只在删除失败时用，避免误报成功） */
function countFiles(dir) {
  let n = 0
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, ent.name)
      if (ent.isDirectory()) walk(abs)
      else n += 1
    }
  }
  try { walk(dir) } catch { /* 读不了就按 0 算，后面按 existsSync 判定 */ }
  return n
}

if (!existsSync(DIST)) {
  console.log('[clean-dist] dist/ 不存在，无需清理')
  process.exit(0)
}

const before = countFiles(DIST)
// 实测（本轮）：受限沙箱下这里会**直接抛 EPERM**（`EPERM ... syscall: 'rm'`），
// 而不是静默返回。Vite 内部把它吞掉了，才表现为「emptyOutDir 静默无效」。
// 所以必须自己 try/catch：否则脚本会以未捕获异常退出，看不到下面那段人话提示。
try {
  rmSync(DIST, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
} catch (err) {
  // 删除失败不立即退出：下面统一回读验证，再给同一条可执行的处理建议
  console.error(`[clean-dist] rmSync 失败：${err?.code || ''} ${err?.message || err}`)
}

// 关键：删完必须回读验证。抛错/不抛错都不算数，磁盘上还在不在才算数
if (existsSync(DIST)) {
  const after = countFiles(DIST)
  console.error('')
  console.error('[clean-dist] ❌ dist/ 没有被删除（残留 ' + after + ' 个文件）')
  console.error('             受限沙箱下 dist 删除会被拒（EPERM），Vite 又把它吞掉，')
  console.error('             于是 emptyOutDir 静默失效、旧产物留在 dist/（文档 §8.4 / §8.5）。')
  console.error('             请改用放宽权限的方式构建，或在 PowerShell 里手动清一次：')
  console.error('               Remove-Item -Recurse -Force "dist"; npm run build --cache "./.npm-cache"')
  console.error('             原因：残留的 assets/index-<旧hash>.js 会让"改完没生效"再次发生。')
  console.error('')
  process.exit(1)
}

console.log(`[clean-dist] ✅ 已清空 dist/（删除 ${before} 个文件）`)
