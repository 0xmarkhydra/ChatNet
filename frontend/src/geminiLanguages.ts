// Google Gemini Live Translation supported language tags (2026-09 API docs).
// Keep this distinct from ChatNet's broader application-translation language list.
export const GEMINI_LIVE_LANGUAGES = [
  'af','ak','sq','am','ar','hy','az','eu','be','bn','bg','my','ca','zh-Hans','zh-Hant',
  'hr','cs','da','nl','en','et','fil','fi','fr','gl','ka','de','el','gu','ha',
  'he','hi','hu','is','id','it','ja','jv','kn','kk','km','rw','ko','lo','lv','lt',
  'mk','ms','ml','mr','mn','ne','no','nb','fa','pl','pt-BR','pt-PT','pa','ro',
  'ru','sr','sd','si','sk','sl','es','su','sw','sv','ta','te','th','tr','uk','ur',
  'uz','vi','zu',
] as const
export function normalizeGeminiLanguage(value: string) {
  const tag = value.trim().toLowerCase()
  if (tag === 'pt') return 'pt-BR'
  if (tag === 'zh') return 'zh-Hans'
  if (tag === 'tl') return 'fil'
  return GEMINI_LIVE_LANGUAGES.find((code) => code.toLowerCase() === tag)
    || GEMINI_LIVE_LANGUAGES.find((code) => code.toLowerCase() === tag.split('-')[0])
    || 'en'
}
