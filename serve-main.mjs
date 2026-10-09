// 静态文件服务器：伺服主项目的 dist 文件夹（供稳定预览）
import http from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, sep } from 'node:path'

// 端口：默认 5175（避开 5173 可能被旧进程占用的端口），也可用参数指定：node serve-main.mjs 5175
const PORT = Number(process.argv[2]) || 5175

const ROOT = join(process.cwd(), 'dist')
// 文本类补 ;charset=utf-8：站内文案全中文，别让浏览器按本地代码页去猜。
// 扩展名一律转小写再查表 —— public/ 下的素材是【大写 .PNG】（guqhan.PNG / tongling.PNG 等），
// 改前 .PNG 查不到映射会被当成 application/octet-stream 发出去。
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

/* 缓存策略（2026-09-24 补齐；对应交接文档 §8.5 的「待办（未做）」）
   改前：所有响应都不带 Cache-Control → 浏览器走"启发式缓存"，可能长期留着旧的
        index.html，而它引用的 assets/index-<旧 hash>.js 已被新构建顶掉 →
        页面加载的还是旧 bundle，看起来就是"改完没生效"（§8.5 记录过这个坑）。
   改后：按【文件名是否带内容 hash】分两档 ——
     · 入口 HTML             → no-cache：每次回服务器核对，入口永远不会滞留旧版；
     · /assets/ 下的产物      → 文件名含内容 hash，内容一变文件名必变 → 一年 immutable；
     · 其余（图片/字体/视频）  → 一小时：同名替换时最多一小时后自动更新。
   判定只看请求路径，不引入构建清单文件：零依赖、零配置，与 Vite 的产物命名约定一致。 */
function cacheControlFor(pathname) {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  if (extname(pathname).toLowerCase() === '.html') return 'no-cache'
  return 'public, max-age=3600'
}

/* 把请求 URL 解析成 dist 内的真实文件；越界（../ 或编码后的 %2e%2e）或编码非法 → null。
   安全意义：改前是直接 join(ROOT, url)，`/../serve-main.mjs` 能读到 dist 之外的文件；
   这里先解码、再由 join 规范化，最后做"必须仍在 dist 内"的前缀校验。 */
function resolveRequest(url) {
  let pathname
  try {
    pathname = decodeURIComponent(String(url || '/').split('?')[0])
  } catch {
    return null                              // 非法百分号编码
  }
  if (pathname === '/') pathname = '/index.html'
  const abs = join(ROOT, pathname)           // join 会规范化掉 . 与 ..
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null
  return { abs, pathname }
}

const server = http.createServer((req, res) => {
  const hit = resolveRequest(req.url)
  // 目录 / 越界 / 不存在 → 统一 404；404 明确 no-store，免得旧产物下线后仍被挡在缓存里
  if (!hit || !existsSync(hit.abs) || !statSync(hit.abs).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end('not found')
    return
  }
  // 每次请求都重新读盘：npm run build 换掉产物后，刷新即生效（服务器自身不缓存文件内容）
  const body = readFileSync(hit.abs)
  res.writeHead(200, {
    'Content-Type': TYPES[extname(hit.abs).toLowerCase()] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': cacheControlFor(hit.pathname)
  })
  res.end(body)
})

server.listen(PORT, '127.0.0.1', () => console.log('✅ 主项目已伺服: http://localhost:' + PORT))
