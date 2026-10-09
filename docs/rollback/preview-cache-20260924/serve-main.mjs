// 静态文件服务器：伺服主项目的 dist 文件夹（供稳定预览）
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'

// 端口：默认 5175（避开 5173 可能被旧进程占用的端口），也可用参数指定：node serve-main.mjs 5175
const PORT = Number(process.argv[2]) || 5175

const ROOT = join(process.cwd(), 'dist')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }

const server = http.createServer((req, res) => {
  let path = req.url.split('?')[0]
  if (path === '/') path = '/index.html'
  const file = join(ROOT, path)
  if (existsSync(file)) {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  } else {
    res.writeHead(404); res.end('not found')
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`✅ 主项目已伺服: http://localhost:${PORT}`))
