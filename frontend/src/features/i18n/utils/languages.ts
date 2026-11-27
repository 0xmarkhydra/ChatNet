import { APP_LOCALE_LABELS, isAppLocale } from '../../../shared/i18n/supportedLocales'

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

// English ISO 639 names cover codes missing from the browser's ICU data.
// Keep the supported code set and the fallback labels in one catalogue.
const ENGLISH_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  aa: "Afar", ab: "Abkhazian", ae: "Avestan", af: "Afrikaans", ak: "Akan", am: "Amharic", an: "Aragonese", ar: "Arabic", as: "Assamese", av: "Avaric", ay: "Aymara", az: "Azerbaijani",
  ba: "Bashkir", be: "Belarusian", bg: "Bulgarian", bh: "Bihari languages", bi: "Bislama", bm: "Bambara", bn: "Bengali", bo: "Tibetan", br: "Breton", bs: "Bosnian",
  ca: "Catalan", ce: "Chechen", ch: "Chamorro", co: "Corsican", cr: "Cree", cs: "Czech", cu: "Church Slavonic", cv: "Chuvash", cy: "Welsh",
  da: "Danish", de: "German", dv: "Divehi", dz: "Dzongkha",
  ee: "Ewe", el: "Greek, Modern (1453-)", en: "English", eo: "Esperanto", es: "Spanish", et: "Estonian", eu: "Basque",
  fa: "Persian", ff: "Fulah", fi: "Finnish", fj: "Fijian", fo: "Faroese", fr: "French", fy: "Western Frisian",
  ga: "Irish", gd: "Gaelic", gl: "Galician", gn: "Guarani", gu: "Gujarati", gv: "Manx",
  ha: "Hausa", he: "Hebrew", hi: "Hindi", ho: "Hiri Motu", hr: "Croatian", ht: "Haitian", hu: "Hungarian", hy: "Armenian", hz: "Herero",
  ia: "Interlingua (International Auxiliary Language Association)", id: "Indonesian", ie: "Interlingue", ig: "Igbo", ii: "Sichuan Yi", ik: "Inupiaq", io: "Ido", is: "Icelandic", it: "Italian", iu: "Inuktitut",
  ja: "Japanese", jv: "Javanese",
  ka: "Georgian", kg: "Kongo", ki: "Kikuyu", kj: "Kuanyama", kk: "Kazakh", kl: "Kalaallisut", km: "Central Khmer", kn: "Kannada", ko: "Korean", kr: "Kanuri", ks: "Kashmiri", ku: "Kurdish", kv: "Komi", kw: "Cornish", ky: "Kirghiz",
  la: "Latin", lb: "Luxembourgish", lg: "Ganda", li: "Limburgan", ln: "Lingala", lo: "Lao", lt: "Lithuanian", lu: "Luba-Katanga", lv: "Latvian",
  mg: "Malagasy", mh: "Marshallese", mi: "Maori", mk: "Macedonian", ml: "Malayalam", mn: "Mongolian", mr: "Marathi", ms: "Malay", mt: "Maltese", my: "Burmese",
  na: "Nauru", nb: "Bokmål, Norwegian", nd: "North Ndebele", ne: "Nepali", ng: "Ndonga", nl: "Dutch", nn: "Norwegian Nynorsk", no: "Norwegian", nr: "South Ndebele", nv: "Navajo", ny: "Chichewa",
  oc: "Occitan (post 1500)", oj: "Ojibwe", om: "Oromo", or: "Oriya", os: "Ossetian",
  pa: "Panjabi", pi: "Pali", pl: "Polish", ps: "Pushto", pt: "Portuguese",
  qu: "Quechua",
  rm: "Romansh", rn: "Rundi", ro: "Romanian", ru: "Russian", rw: "Kinyarwanda",
  sa: "Sanskrit", sc: "Sardinian", sd: "Sindhi", se: "Northern Sami", sg: "Sango", si: "Sinhala", sk: "Slovak", sl: "Slovenian", sm: "Samoan", sn: "Shona", so: "Somali", sq: "Albanian", sr: "Serbian", ss: "Swati", st: "Sotho, Southern", su: "Sundanese", sv: "Swedish", sw: "Swahili",
  ta: "Tamil", te: "Telugu", tg: "Tajik", th: "Thai", ti: "Tigrinya", tk: "Turkmen", tl: "Tagalog", tn: "Tswana", to: "Tonga (Tonga Islands)", tr: "Turkish", ts: "Tsonga", tt: "Tatar", tw: "Twi", ty: "Tahitian",
  ug: "Uighur", uk: "Ukrainian", ur: "Urdu", uz: "Uzbek",
  ve: "Venda", vi: "Vietnamese", vo: "Volapük",
  wa: "Walloon", wo: "Wolof",
  xh: "Xhosa", yi: "Yiddish", yo: "Yoruba",
  za: "Zhuang", zh: "Chinese", zu: "Zulu",
}
const ISO_639_1_CODES = Object.keys(ENGLISH_LANGUAGE_NAMES)

const ISO_639_1_SET = new Set(ISO_639_1_CODES)

export function isSupportedLanguageCode(value: string) {
  return ISO_639_1_SET.has(value.trim().toLowerCase().split('-')[0])
}

function safeDisplayName(locale: string, type: 'language' | 'region', value: string) {
  try {
    const names = new Intl.DisplayNames([locale], { type, fallback: 'none' })
    return names.of(value)
  } catch {
    return undefined
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
      ?? safeDisplayName('en', 'language', code)
      ?? ENGLISH_LANGUAGE_NAMES[code]
    const nativeLanguage = safeDisplayName(code, 'language', code) ?? localizedLanguage
    const localizedRegion = safeDisplayName(locale, 'region', region) ?? region
    const nativeRegion = safeDisplayName(code, 'region', region) ?? localizedRegion
    const flag = flagForRegion(region)
    const searchText = normalizeSearch([
      code,
      localizedLanguage,
      nativeLanguage,
      ENGLISH_LANGUAGE_NAMES[code],
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

export function buildAppLanguageOptions(interfaceLocale = 'vi') {
  return buildLanguageOptions(interfaceLocale).flatMap(option => {
    if (!isAppLocale(option.value)) return []
    const nativeLanguage = APP_LOCALE_LABELS[option.value]
    const localizedLanguage = option.value === 'zh' ? (safeDisplayName(interfaceLocale, 'language', 'zh-Hans') ?? option.localizedLanguage) : option.localizedLanguage
    return [{ ...option, localizedLanguage, nativeLanguage, searchText: normalizeSearch([option.searchText, localizedLanguage, nativeLanguage].join(' ')) }]
  })
}

export function filterLanguageOptions(options: LanguageOption[], query: string) {
  const normalized = normalizeSearch(query)
  if (!normalized) return options
  return options.filter((option) => option.searchText.includes(normalized))
}
