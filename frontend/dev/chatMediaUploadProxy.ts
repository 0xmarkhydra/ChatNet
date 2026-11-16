import { request as httpsRequest } from 'node:https'
import type { Plugin } from 'vite'

// Local-development fallback for S3 buckets that do not permit browser PUT
// requests from localhost/LAN origins. Production must use a bucket CORS
// policy or an authenticated backend upload relay.
export const DEV_MEDIA_UPLOAD_ROUTE = '/__chatnet_s3_upload'
const MAX_BYTES = 150 * 1024 * 1024

export function allowedChatNetUploadURL(raw: string): boolean {
  if (!raw || raw.length > 8192) return false
  let target: URL
  try { target = new URL(raw) } catch { return false }
  if (target.protocol !== 'https:' || target.username || target.password || target.port) return false
  const host = target.hostname.toLowerCase()
  if (host !== 's3-hcm-r2.s3cloud.vn' && !host.endsWith('.s3-hcm-r2.s3cloud.vn')) return false
  if (target.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' ||
    !/^[\da-f]{64}$/i.test(target.searchParams.get('X-Amz-Signature') || '')) return false
  if (target.searchParams.get('X-Amz-SignedHeaders') !== 'host') return false
  let path: string
  try { path = decodeURIComponent(target.pathname) } catch { return false }
  return /^\/(?:[^/]+\/)?chatnet\/(?:chat|feed|story|profile)\/\d+\/\d{4}\/\d{2}\/[\da-f]{32}\.[a-z0-9]{1,10}$/i.test(path)
}

export function chatMediaUploadDevProxy(): Plugin {
  return {
    name: 'chatnet-s3-upload-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(DEV_MEDIA_UPLOAD_ROUTE, (req, res) => {
        if (req.method !== 'PUT') {
          res.writeHead(405, { Allow: 'PUT' }).end()
          return
        }
        const suppliedOrigin = req.headers.origin
        const currentHost = req.headers.host
        // Only requests from this Vite instance are permitted.
        if (suppliedOrigin) {
          let sameOrigin = false
          try {
            const origin = new URL(suppliedOrigin)
            sameOrigin = origin.host === currentHost &&
              (origin.protocol === 'http:' || origin.protocol === 'https:')
          } catch { /* Reject malformed origins without crashing Vite. */ }
          if (!sameOrigin) {
            res.writeHead(403).end('Origin not allowed')
            return
          }
        }
        const signed = new URL(req.url || '/', 'http://localhost').searchParams.get('url') || ''
        const length = Number(req.headers['content-length'])
        if (!allowedChatNetUploadURL(signed)) {
          res.writeHead(403).end('Upload URL not permitted')
          return
        }
        if (!Number.isSafeInteger(length) || length < 1 || length > MAX_BYTES) {
          res.writeHead(413).end('Upload size is invalid')
          return
        }
        const upstream = httpsRequest(signed, {
          method: 'PUT',
          headers: { 'Content-Type': req.headers['content-type'] || 'application/octet-stream',
            'Content-Length': length },
          timeout: 120000,
        }, response => {
          response.resume()
          response.on('end', () => {
            if (res.headersSent || res.writableEnded) return
            const status = response.statusCode || 502
            res.writeHead(status >= 200 && status < 300 ? 204 : status, {
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            }).end()
          })
        })
        upstream.on('error', () => { if (!res.headersSent && !res.writableEnded) res.writeHead(502).end('Storage unavailable') })
        upstream.on('timeout', () => upstream.destroy(new Error('Storage timeout')))
        req.on('aborted', () => upstream.destroy())
        req.pipe(upstream)
      })
    },
  }
}
