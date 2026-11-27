import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCatalog, compareCatalog, translateMissing, locales } from './i18n-catalogs.mjs'

test('validates five locales, exact keys and interpolation placeholders', () => {
  assert.deepEqual(locales, ['vi','en','zh','ja','ko'])
  const source = parseCatalog("export default {'common.count': 'Có {count} mục'} as const", 'catalog.ts')
  assert.deepEqual(compareCatalog(source, {'common.count':'{count} items'}), { missing:[], extra:[], invalid:[] })
  assert.deepEqual(compareCatalog(source, {'common.count':'items','common.extra':'x'}), { missing:[], extra:['common.extra'], invalid:['common.count'] })
  assert.deepEqual(compareCatalog(source, {}), { missing:['common.count'], extra:[], invalid:[] })
  assert.throws(()=>parseCatalog("export default {'common.a':'a','common.a':'b'}", 'bad.ts'))
})

test('only sends requested missing keys and rejects malformed/unchanged responses', async () => {
  let calls = 0
  const result = await translateMissing('https://example.test/api/i18n/bundle', undefined, 'ja', {'common.count':'Có {count} mục'}, async (_url, init) => {
    calls++
    assert.deepEqual(JSON.parse(init.body).messages, {'common.count':'Có {count} mục'})
    return Response.json({locale:'ja',messages:{'common.count':'{count} 件'}})
  })
  assert.equal(result['common.count'],'{count} 件')
  assert.equal(calls,1)
  await translateMissing('https://example.test',undefined,'ja',{},()=>{throw new Error('unexpected request')})
  await assert.rejects(translateMissing('https://example.test',undefined,'ja',{'common.count':'Có {count} mục'},async()=>Response.json({locale:'ja',messages:{'common.count':'項目'}})))
  await assert.rejects(translateMissing('https://example.test',undefined,'ja',{'common.count':'Có {count} mục'},async()=>Response.json({locale:'ja',messages:{'common.count':'Có {count} mục'}})))
})
