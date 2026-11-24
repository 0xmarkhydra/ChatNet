import { useCallback, useEffect, useRef, useState } from 'react'
import { requestFeedTranslation } from '../api/translation'

type FeedTranslationOptions = { api: string; token: string; text: string; target: string }

const translationCache = new Map<string, string>()

export function useFeedTranslation({ api, token, text, target }: FeedTranslationOptions) {
  const host = useRef<HTMLDivElement>(null)
  const key = JSON.stringify([api, token, target, text])
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState({ key: '', text: '' })
  const cached = visible ? translationCache.get(key) : undefined
  const translated = result.key === key ? result.text : cached ?? ''
  const [failed, setFailed] = useState(false)
  const resetFailed = useCallback(() => setFailed(false), [])

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    })
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !text.trim() || !target) return
    const cached = translationCache.get(key)
    if (cached) return
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | undefined
    async function translate(attempt = 0) {
      try {
        const response = await requestFeedTranslation({ api, token, text, target, signal: controller.signal })
        if (!response.ok) throw new Error('Translation unavailable')
        const result = await response.json() as { translatedText?: string }
        if (!result.translatedText?.trim()) throw new Error('Empty translation')
        if (controller.signal.aborted) return
        if (translationCache.size >= 200) translationCache.delete(translationCache.keys().next().value!)
        translationCache.set(key, result.translatedText)
        setResult({ key, text: result.translatedText })
      } catch {
        if (controller.signal.aborted) return
        if (attempt < 2) retry = setTimeout(() => void translate(attempt + 1), 2000 * (attempt + 1))
        else setFailed(true)
      }
    }
    void translate()
    return () => {
      controller.abort()
      clearTimeout(retry)
    }
  }, [api, token, target, text, visible, key])

  return { host, key, translated, failed, visible, resetFailed }
}
