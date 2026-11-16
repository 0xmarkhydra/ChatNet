import { useEffect, useMemo, useState } from 'react'
import { buildLanguageOptions } from '../../i18n'
import type { CallRequest } from '../lib/calls'
import { useLatest } from '../../../shared/hooks/useLatest'

export function useCallLanguages(request: CallRequest, sourceLanguage: string, targetLanguage: string) {
  const [callTargetLanguage, setCallTargetLanguage] = useState<string>(() => {
    const lang = (localStorage.getItem('chatnet.call.target-language.v1') || targetLanguage).toLowerCase().split('-')[0]
    return lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang === 'tl' ? 'fil' : lang
  })
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const targetLanguageRef = useLatest(targetLanguage)
  useEffect(() => {
    let mounted = true
    request('/api/calls/translation/languages').then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { languages?: string[] }
      const languages = body.languages
      if (mounted && Array.isArray(languages)) {
        setAvailableLanguages(languages)
        setCallTargetLanguage(current => {
          if (languages.includes(current)) return current
          const preferred = targetLanguageRef.current.split('-')[0]
          return languages.includes(preferred) ? preferred : 'en'
        })
      }
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [request, targetLanguageRef])

  const languageOptions = useMemo(() => {
    const catalog = buildLanguageOptions(sourceLanguage)
    return availableLanguages.map((value) => {
      const option = catalog.find((item) => item.code === value.split('-')[0])
      const fallback = new Intl.DisplayNames([sourceLanguage], { type: 'language' }).of(value) || value
      return { value, label: (option?.flag || '🌐') + ' ' + (option?.localizedLanguage || fallback) +
        (value.includes('-') ? ' (' + value + ')' : '') + ' · ' + (option?.nativeLanguage || value) }
    }).sort((a,b) => a.label.localeCompare(b.label, sourceLanguage))
  }, [sourceLanguage, availableLanguages])

  return { callTargetLanguage, setCallTargetLanguage, languageOptions }
}
