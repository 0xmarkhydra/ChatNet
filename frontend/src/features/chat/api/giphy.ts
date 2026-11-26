export type GiphyKind = 'gifs' | 'stickers'
export type GiphyItem = { id: string; title: string; preview: string; url: string }

export const giphyConfigured = Boolean(import.meta.env.VITE_GIPHY_API_KEY)

export function isGiphyMedia(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      /^(?:media[0-9]*|i)\.giphy\.com$/.test(url.hostname) && /\.gif$/.test(url.pathname)
  } catch { return false }
}

export async function searchGiphy(kind: GiphyKind, query: string, signal: AbortSignal): Promise<GiphyItem[]> {
  const key = import.meta.env.VITE_GIPHY_API_KEY
  if (!key) throw new Error('Chưa cấu hình API key GIPHY')
  const q = query.trim()
  const params = new URLSearchParams({ api_key: key, limit: '24', rating: 'g', lang: 'vi' })
  if (q) params.set('q', q)
  const response = await fetch('https://api.giphy.com/v1/' + kind + '/' + (q ? 'search' : 'trending') + '?' + params, { signal, credentials: 'omit' })
  if (!response.ok) throw new Error(response.status === 429 ? 'Đã vượt giới hạn GIPHY. Vui lòng thử lại sau.' : 'Không thể tải kho GIPHY.')
  const result = await response.json() as { data?: { id: string; title: string; images?: { fixed_width_small?: { url?: string }; original?: { url?: string } } }[] }
  return (result.data ?? []).flatMap(item => {
    const preview = item.images?.fixed_width_small?.url
    const url = item.images?.original?.url
    return preview && url && isGiphyMedia(preview) && isGiphyMedia(url) ? [{ id: item.id, title: item.title || 'GIPHY', preview, url }] : []
  })
}
