export type LanguageOption = {
  value: string
  code: string
  flag: string
  region: string
  localizedLanguage: string
  nativeLanguage: string
  localizedRegion: string
  nativeRegion: string
  searchText: string
}

const ISO_639_1_CODES = `
aa ab ae af ak am an ar as av ay az
ba be bg bh bi bm bn bo br bs
ca ce ch co cr cs cu cv cy
da de dv dz
ee el en eo es et eu
fa ff fi fj fo fr fy
ga gd gl gn gu gv
ha he hi ho hr ht hu hy hz
ia id ie ig ii ik io is it iu
ja jv
ka kg ki kj kk kl km kn ko kr ks ku kv kw ky
la lb lg li ln lo lt lu lv
mg mh mi mk ml mn mr ms mt my
na nb nd ne ng nl nn no nr nv ny
oc oj om or os
pa pi pl ps pt
qu
rm rn ro ru rw
sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw
ta te tg th ti tk tl tn to tr ts tt tw ty
ug uk ur uz
ve vi vo
wa wo
xh yi yo
za zh zu
`.trim().split(/\s+/)

function safeDisplayName(locale: string, type: 'language' | 'region', value: string) {
  try {
    const names = new Intl.DisplayNames([locale], { type })
    return names.of(value) || value
  } catch {
    return value
  }
}

function regionForLanguage(code: string) {
  try {
    return new Intl.Locale(code).maximize().region || '001'
  } catch {
    return '001'
  }
}

function flagForRegion(region: string) {
  if (!/^[A-Z]{2}$/.test(region)) return '🌐'
  return String.fromCodePoint(...region.split('').map((char) => 127397 + char.charCodeAt(0)))
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

export function buildLanguageOptions(interfaceLocale = 'vi'): LanguageOption[] {
  const locale = interfaceLocale || 'vi'
  return ISO_639_1_CODES.map((code) => {
    const region = regionForLanguage(code)
    const localizedLanguage = safeDisplayName(locale, 'language', code)
    const nativeLanguage = safeDisplayName(code, 'language', code)
    const localizedRegion = safeDisplayName(locale, 'region', region)
    const nativeRegion = safeDisplayName(code, 'region', region)
    const flag = flagForRegion(region)
    const searchText = normalizeSearch([
      code,
      localizedLanguage,
      nativeLanguage,
      localizedRegion,
      nativeRegion,
      region,
    ].join(' '))

    return {
      value: code,
      code: code.toUpperCase(),
      flag,
      region,
      localizedLanguage,
      nativeLanguage,
      localizedRegion,
      nativeRegion,
      searchText,
    }
  }).sort((a, b) => a.localizedLanguage.localeCompare(b.localizedLanguage, locale, { sensitivity: 'base' }))
}

export function filterLanguageOptions(options: LanguageOption[], query: string) {
  const normalized = normalizeSearch(query)
  if (!normalized) return options
  return options.filter((option) => option.searchText.includes(normalized))
}
