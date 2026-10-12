import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const PORT = process.env.PORT || 3000
const HOST = '0.0.0.0'
const INDEX = join(ROOT, 'index.html')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
}

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const target = normalize(join(root, decoded))
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

function send(res, status, headers, stream) {
  res.writeHead(status, headers)
  if (stream) stream.pipe(res)
  else res.end()
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' })
  }

  let filePath = safeJoin(ROOT, req.url || '/')
  if (!filePath) return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' })

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html')
  }

  const isAsset = filePath.startsWith(join(ROOT, 'assets') + sep)
  const served = (existsSync(filePath) && statSync(filePath).isFile()) ? filePath : INDEX

  if (!existsSync(served)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('Build output not found. Did the build run?')
  }

  const headers = {
    'Content-Type': contentType(served),
    'Cache-Control': isAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  }
  headers['Content-Length'] = String(statSync(served).size)

  if (req.method === 'HEAD') return send(res, 200, headers)
  send(res, 200, headers, createReadStream(served))
})

server.listen(PORT, HOST, () => {
  console.log(`masahati static server listening on http://${HOST}:${PORT} (root: ${ROOT})`)
})
