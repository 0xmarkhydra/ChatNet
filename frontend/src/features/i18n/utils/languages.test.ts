import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLanguageOptions, filterLanguageOptions } from './languages'

afterEach(() => vi.unstubAllGlobals())

describe('language names in the picker', () => {
  it('resolves and searches names missing from localized ICU data', () => {
    const options = buildLanguageOptions('vi')
    for (const [code, name] of [['aa', 'Afar'], ['ab', 'Abkhazian'], ['ae', 'Avestan']]) {
      const option = options.find(entry => entry.value === code)
      expect(option?.localizedLanguage.toLowerCase()).not.toBe(code)
      expect(option?.nativeLanguage.toLowerCase()).not.toBe(code)
      expect(option?.code).toBe(code.toUpperCase())
      expect(filterLanguageOptions(options, name).some(entry => entry.value === code)).toBe(true)
    }
  })

  it('keeps all codes readable and searchable without Intl.DisplayNames', () => {
    vi.stubGlobal('Intl', Object.create(Intl, { DisplayNames: { value: undefined } }))
    const options = buildLanguageOptions('vi')
    expect(options.length).toBeGreaterThan(170)
    expect(options.every(option => option.localizedLanguage.toLowerCase() !== option.value)).toBe(true)
    expect(filterLanguageOptions(options, 'avestan').map(option => option.value)).toEqual(['ae'])
    expect(filterLanguageOptions(options, 'vi').some(option => option.value === 'vi')).toBe(true)
  })
})
