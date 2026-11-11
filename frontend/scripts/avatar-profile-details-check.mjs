import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const cssFiles = [
  '../src/styles/styles.css',
  '../src/styles/zalo-inspired.css',
  '../src/styles/soco-theme.css',
  '../src/styles/soco-layout-v2.css',
  '../src/styles/app-shell.css',
  '../src/features/profile/profile-page.css',
  '../src/features/chat/social-chat.css',
  '../src/styles/adaptive-pwa.css',
]
const css = cssFiles.map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')

const browser = await chromium.launch({ headless: true })
try {
  for (const width of [320, 390, 768, 1440, 1680]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.setContent(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
  <div class="modern-shell app-layout">
    <aside class="app-sidebar">
      <nav class="app-sidebar-nav"></nav>
      <button class="app-sidebar-account">
        <div class="app-sidebar-avatar smart-avatar">
          <span class="avatar-initials">TH</span>
          <span class="avatar-shine"></span>
          <span class="presence-dot"></span>
        </div>
        <span class="app-sidebar-account-copy"><strong>thaqPWA</strong><small>Đang hoạt động</small></span>
      </button>
    </aside>
    <aside class="conversation-info-panel social-chat-details" style="display:flex">
      <div class="conversation-info-panel-identity social-chat-details-identity">
        <div class="conversation-info-panel-avatar social-chat-details-avatar smart-avatar">
          <span class="avatar-initials">AB</span>
          <span class="avatar-shine"></span>
          <span class="presence-dot"></span>
        </div>
        <strong>Nguyễn Văn A</strong>
        <span>● Đang hoạt động</span>
      </div>
    </aside>
    <main class="simple-view profile-view">
      <section class="profile-hero">
        <div class="profile-cover-art"></div>
        <div class="profile-identity">
          <div class="profile-avatar-editor">
            <div class="profile-avatar smart-avatar">
              <span class="avatar-initials">CD</span>
              <span class="avatar-shine"></span>
            </div>
            <button class="profile-avatar-edit" aria-label="Đổi ảnh đại diện"></button>
          </div>
          <div class="profile-identity-copy"><strong>Nguyễn Văn B</strong><span>@b</span></div>
        </div>
      </section>
    </main>
    <section class="profile-page">
      <div class="profile-page-hero">
        <div class="profile-page-cover"></div>
        <div class="profile-page-avatar-wrap">
          <div class="profile-page-avatar smart-avatar">
            <span class="avatar-initials">TH</span>
            <span class="avatar-shine"></span>
            <span class="presence-dot"></span>
          </div>
          <button class="profile-page-avatar-action" aria-label="Đổi ảnh đại diện"></button>
        </div>
        <div class="profile-page-hero-bottom"><h1>thaqPWA</h1></div>
      </div>
      <div class="profile-page-friends">
        <button class="profile-page-friend">
          <div class="profile-page-friend-avatar smart-avatar"><span class="avatar-initials">AB</span></div>
        </button>
      </div>
    </section>
    <div class="profile-page-header-avatar smart-avatar"><span class="avatar-initials">CD</span></div>
  </div>
</body></html>`)
    await page.addStyleTag({ content: css })
    const actual = await page.evaluate(() => {
      const rect = (el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, centerX: r.x + r.width / 2, centerY: r.y + r.height / 2 }
      }
      return {
        avatars: [
          '.conversation-info-panel-avatar',
          '.profile-avatar-editor > .profile-avatar',
          ...(window.innerWidth >= 761 ? [
            '.profile-page .profile-page-avatar',
            '.profile-page-friend-avatar',
            '.profile-page-header-avatar',
            '.app-sidebar-avatar',
          ] : []),
        ].map(selector => {
          const avatar = document.querySelector(selector)
          const initials = avatar.querySelector('.avatar-initials')
          return { avatar: rect(avatar), initials: rect(initials), display: getComputedStyle(avatar).display, fontSize: parseFloat(getComputedStyle(initials).fontSize) }
        }),
        editor: rect(document.querySelector('.profile-avatar-editor')),
        edit: rect(document.querySelector('.profile-avatar-edit')),
        pageAvatarWrap: rect(document.querySelector('.profile-page-avatar-wrap')),
        pageAvatarAction: rect(document.querySelector('.profile-page-avatar-action')),
        sidebarDot: rect(document.querySelector('.app-sidebar-avatar .presence-dot')),
        statusFontSize: parseFloat(getComputedStyle(document.querySelector('.conversation-info-panel-identity > span')).fontSize),
      }
    })
    for (const [index, item] of actual.avatars.entries()) {
      assert.equal(item.display, 'grid', `avatar ${index} must use grid at ${width}px`)
      assert.ok(Math.abs(item.avatar.width - item.avatar.height) <= 1, `avatar ${index} not square at ${width}px`)
      assert.ok(Math.abs(item.avatar.centerX - item.initials.centerX) <= 1 && Math.abs(item.avatar.centerY - item.initials.centerY) <= 1,
        `initials misaligned at ${width}px: ${JSON.stringify(item)}`)
    }
    assert.equal(actual.avatars[0].fontSize, 28, `conversation initials font incorrect at ${width}px`)
    assert.equal(actual.statusFontSize, 12, `conversation status size changed at ${width}px`)
    assert.ok(Math.abs(actual.editor.centerX - actual.avatars[1].avatar.centerX) <= 1 &&
      Math.abs(actual.editor.centerY - actual.avatars[1].avatar.centerY) <= 1,
      `profile avatar offset inside editor at ${width}px`)
    assert.ok(actual.edit.centerX > actual.editor.centerX &&
      actual.edit.centerY > actual.editor.centerY, `edit button misplaced at ${width}px`)
    if (width >= 761) {
      const pageAvatar = actual.avatars[2].avatar
      assert.ok(Math.abs(pageAvatar.centerX - actual.pageAvatarWrap.centerX) <= 1 &&
        Math.abs(pageAvatar.centerY - actual.pageAvatarWrap.centerY) <= 1,
        `main ProfilePage avatar not centered in wrap at ${width}px`)
      assert.ok(actual.pageAvatarAction.centerX > pageAvatar.centerX &&
        actual.pageAvatarAction.centerY > pageAvatar.centerY,
        `main ProfilePage camera action misplaced at ${width}px`)
      const sidebarAvatar = actual.avatars[5].avatar
      assert.ok(actual.sidebarDot.centerX > sidebarAvatar.centerX &&
        actual.sidebarDot.centerY > sidebarAvatar.centerY,
        `sidebar presence indicator misplaced at ${width}px`)
      assert.equal(sidebarAvatar.width, 43, `sidebar avatar width changed at ${width}px`)
    }
    await page.close()
    console.log(`PASS avatar geometry at ${width}px: conversation details, personal profile, ProfilePage, sidebar`)
  }
} finally {
  await browser.close()
}
