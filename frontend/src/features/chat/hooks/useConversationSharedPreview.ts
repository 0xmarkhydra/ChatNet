import { useEffect, useRef, useState } from 'react'
import { loadSharedContent, type SharedAttachment } from '../lib/sharedContentLoader'

export type SharedPreviewItem = { id: string; kind: 'image' | 'video'; url: string; name: string }


export function useConversationSharedPreview({
  conversationId, channelId, request,
}: {
  conversationId: number
  channelId: number
  request: (path: string, init?: RequestInit) => Promise<Response>
}) {
  const requestRef = useRef(request)
  useEffect(() => { requestRef.current = request }, [request])
  const [items, setItems] = useState<SharedPreviewItem[]>([])
  const [mediaCount, setMediaCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadSharedContent({
      conversationId, channelId, kind: 'media', limit: 24,
      request: requestRef.current, signal: controller.signal,
    })
      .then(data => {
        if (controller.signal.aborted) return
        const media = (data.items || []).flatMap(message => (message.attachments || [])
          .filter((item): item is SharedAttachment & { kind: 'image' | 'video'; url: string } =>
            (item.kind === 'image' || item.kind === 'video') && Boolean(item.url))
          .map(item => ({
            id: `${message.id}-${item.id || item.url}`,
            kind: item.kind,
            name: item.name || 'Phương tiện đã chia sẻ',
            url: item.url,
          })))
        setItems(media.slice(0, 4))
        setMediaCount(media.length)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [conversationId, channelId, retryKey])


  function retry() {
    setItems([])
    setViewerIndex(null)
    setMediaCount(0)
    setLoading(true)
    setError(false)
    setRetryKey(key => key + 1)
  }
  return { items, mediaCount, loading, error, viewerIndex, setViewerIndex, retry }
}
