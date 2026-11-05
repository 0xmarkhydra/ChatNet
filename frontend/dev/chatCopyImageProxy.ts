import type { Plugin } from 'vite'

const route = '/__chatnet_copy_image'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/**
 * Dev-only, single-purpose image proxy for clipboard reads.
 * Browsers can display a presigned S3 image using <img>, but canvas/clipboard
 * reads need CORS. This route restricts destinations instead of accepting an
 * arbitrary remote URL (which would create a local SSRF proxy).
 */
export function allowedChatCopyImageURL(raw: string): boolean {
  if (!raw || raw.length > 8192) return false
  let parsed: URL
  try { parsed = new URL(raw) } catch { return false }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false
  const host = parsed.hostname.toLowerCase()
  if (host !== 's3-hcm-r2.s3cloud.vn' && !host.endsWith('.s3-hcm-r2.s3cloud.vn')) return false
  if (parsed.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' ||
      !/^[0-9a-f]{64}$/i.test(parsed.searchParams.get('X-Amz-Signature') ?? '')) return false
  // Only chat image uploads within this application's object key namespace.
  let path: string
  try { path = decodeURIComponent(parsed.pathname) } catch { return false }
  if (!/^\/(?:[^/]+\/)?chatnet\/chat\/\d+\/[0-9]{4}\/[0-9]{2}\/[a-f0-9]{32}\.(?:png|jpg|jpeg|webp|gif|heic|heif)$/i.test(path)) return false
  return true
}

export function chatCopyImageDevProxy(): Plugin {
  return {
    name: 'chatnet-copy-image-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(route, async (req, res) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { Allow: 'GET' }).end()
          return
        }
        const src = new URL(req.url || '/', 'http://localhost').searchParams.get('url') || ''
        if (!allowedChatCopyImageURL(src)) {
          res.writeHead(403).end('URL anh khong duoc phep.')
          return
        }
        try {
          const response = await fetch(src, {
            redirect: 'manual',
            headers: { Accept: 'image/*' },
            signal: AbortSignal.timeout(15000),
          })
          if (!response.ok || !response.body) {
            res.writeHead(response.status === 403 ? 403 : 502).end('Anh khong con truy cap duoc.')
            return
          }
          const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
          const contentLength = Number(response.headers.get('content-length') || 0)
          if (!mime.startsWith('image/') || contentLength > MAX_IMAGE_BYTES) {
            await response.body.cancel()
            res.writeHead(415).end('Tep khong phai anh hop le.')
            return
          }
          let total = 0
          const chunks: Uint8Array[] = []
          for await (const chunk of response.body) {
            total += chunk.byteLength
            if (total > MAX_IMAGE_BYTES) {
              res.writeHead(413).end('Anh vuot qua gioi han 20 MB.')
              return
            }
            chunks.push(chunk)
          }
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': total,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          res.end(Buffer.concat(chunks, total))
        } catch {
          if (!res.headersSent) res.writeHead(502).end('Khong tai duoc anh tu kho luu tru.')
        }
      })
    },
  }
}
