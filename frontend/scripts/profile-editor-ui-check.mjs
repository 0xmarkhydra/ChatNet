// Screenshot-independent browser regression for the desktop Profile Editor inputs.
// Run after "npm run build": node scripts/profile-editor-ui-check.mjs
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { chromium } from 'playwright'
import {
  profileEditorFieldClass, profileEditorInputClass, profileEditorLabelClass,
} from '../src/features/profile/components/profileEditorFieldStyles.ts'

const root = process.cwd()
const assets = resolve(root, 'dist/assets')
const styleName = readdirSync(assets).find(file => file.endsWith('.css') && file.startsWith('index-'))
assert.ok(styleName, 'Build the frontend before running the browser layout check')
const styles = readFileSync(join(assets, styleName), 'utf8')
const fields = ['Tên hiển thị', 'Tên người dùng', 'Tiểu sử', 'Thành phố', 'Nơi làm việc', 'Trường học']
const html = `
  <div class="modern-shell app-layout">
    <div class="profile-editor-page">
      <form class="profile-editor-form-card">
        <div class="profile-editor-fields">
          ${fields.map((label, index) => `
            <label class="${profileEditorFieldClass}">
              <span class="${profileEditorLabelClass}">${label}</span>
              <input class="${profileEditorInputClass}" name="field-${index}" placeholder="Tùy chọn" />
            </label>`).join('')}
        </div>
      </form>
    </div>
  </div>
`
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [760, 761, 1000, 1380, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 940 } })
    await page.setContent(html)
    await page.addStyleTag({ content: styles })
    const computed = await page.locator('.profile-editor-field').evaluateAll(nodes =>
      nodes.map(node => {
        const input = node.querySelector('input')
        const label = node.querySelector('span')
        const inputCss = getComputedStyle(input)
        const labelCss = getComputedStyle(label)
        return {
          height: input.getBoundingClientRect().height,
          radius: inputCss.borderRadius,
          fontSize: inputCss.fontSize,
          weight: inputCss.fontWeight,
          background: inputCss.backgroundColor,
          labelWeight: labelCss.fontWeight,
          labelSize: labelCss.fontSize,
        }
      }),
    )
    assert.equal(computed.length, 6, 'Must render six editor fields')
    for (const result of computed) {
      assert.deepEqual(result, computed[0], `Inconsistent input styling at ${width}px`)
    }
    if (width >= 761) {
      assert.equal(computed[0].height, 45)
      assert.equal(computed[0].radius, '10px')
      assert.equal(computed[0].fontSize, '13px')
      assert.equal(computed[0].weight, '510')
      assert.equal(computed[0].labelWeight, '690')
      assert.equal(computed[0].background, 'rgb(248, 250, 254)')
    }
    await page.close()
  }
  console.log('PASS: six Profile Editor fields retain identical desktop styles across 760, 761, 1000, 1380 and 1440px')
} finally {
  await browser.close()
}