import { useEffect, useMemo, useState } from 'react'
import { buildLanguageOptions } from '../../i18n/utils/languages'
import type { CallRequest } from '../lib/calls'

export function useCallLanguages(request: CallRequest, sourceLanguage: string, targetLanguage: string) {
  const [callTargetLanguage, setCallTargetLanguage] = useState<string>(() => {
    const lang = (localStorage.getItem('chatnet.call.target-language.v1') || targetLanguage).toLowerCase().split('-')[0]
    return lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang === 'tl' ? 'fil' : lang
  })
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  useEffect(() => {
    let mounted = true
    request('/api/calls/translation/languages').then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { languages?: string[] }
      if (mounted && Array.isArray(body.languages)) {
        setAvailableLanguages(body.languages)
        if (!body.languages.includes(callTargetLanguage)) {
          setCallTargetLanguage(body.languages.includes(targetLanguage.split('-')[0]) ? targetLanguage.split('-')[0] : 'en')
        }
      }
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [request])

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
