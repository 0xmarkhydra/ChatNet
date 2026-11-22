import test from 'node:test'
import assert from 'node:assert/strict'
import { addedCssDeclarations, hasCurrentOwnerApproval, runCssGuard } from './tailwind-css-pr-check.mjs'

const cssDiff = `diff --git a/frontend/src/features/feed/styles/social-feed.css b/frontend/src/features/feed/styles/social-feed.css
--- a/frontend/src/features/feed/styles/social-feed.css
+++ b/frontend/src/features/feed/styles/social-feed.css
@@ -1,0 +2,2 @@
+.post { color: red; }
+  padding: 2px;
`

test('rejects new rules in legacy CSS files rather than scanning unchanged CSS', () => {
  assert.deepEqual(addedCssDeclarations(cssDiff), [
    { path: 'frontend/src/features/feed/styles/social-feed.css', line: 2, snippet: '.post { color: red; }' },
    { path: 'frontend/src/features/feed/styles/social-feed.css', line: 3, snippet: 'padding: 2px;' },
  ])
})

test('finds added stylesheet rules across created and renamed files', () => {
  const diff = `diff --git a/frontend/src/styles/a.css b/frontend/src/styles/a.css
new file mode 100644
--- /dev/null
+++ b/frontend/src/styles/a.css
@@ -0,0 +1,3 @@
+/* rationale */
+@keyframes fade { to { opacity: 1; } }
+
diff --git a/frontend/src/styles/old.css b/frontend/src/styles/new.css
similarity index 90%
rename from frontend/src/styles/old.css
rename to frontend/src/styles/new.css
--- a/frontend/src/styles/old.css
+++ b/frontend/src/styles/new.css
@@ -4,0 +5 @@
+.title { display: grid; }
`
  assert.equal(addedCssDeclarations(diff).length, 2)
})

test('allows CSS deletions, comment-only edits and non-CSS files', () => {
  const diff = `diff --git a/frontend/src/styles/a.css b/frontend/src/styles/a.css
--- a/frontend/src/styles/a.css
+++ b/frontend/src/styles/a.css
@@ -1 +1,2 @@
-.old { color: red; }
+/* The old rule is removed.
+ * Nothing new is styled. */
diff --git a/frontend/src/app/App.tsx b/frontend/src/app/App.tsx
--- a/frontend/src/app/App.tsx
+++ b/frontend/src/app/App.tsx
@@ -1,0 +2 @@
+<div className="bg-primary" />
`
  assert.deepEqual(addedCssDeclarations(diff), [])
})

test('detects active CSS placed after a comment and does not accept PR text as approval', () => {
  const diff = `diff --git a/frontend/src/styles/a.css b/frontend/src/styles/a.css
--- a/frontend/src/styles/a.css
+++ b/frontend/src/styles/a.css
@@ -1,0 +1 @@
+/* approved by owner */ .secret { color: red; }
`
  assert.equal(addedCssDeclarations(diff).length, 1)
})

test('approval requires the configured reviewer on the exact current commit', () => {
  const sha = 'a'.repeat(40)
  const review = { user: { login: 'Owner' }, commit_id: sha, state: 'APPROVED' }
  assert.equal(hasCurrentOwnerApproval([review], 'owner', sha), true)
  assert.equal(hasCurrentOwnerApproval([review], 'owner', 'b'.repeat(40)), false)
  assert.equal(hasCurrentOwnerApproval([review], 'other', sha), false)
  assert.equal(hasCurrentOwnerApproval([review, { ...review, state: 'CHANGES_REQUESTED' }], 'owner', sha), false)
  assert.equal(hasCurrentOwnerApproval([], 'owner', sha), false)
})

test('the CLI check fails closed without approval and passes deletion-only patches', async () => {
  const fakeGit = (_binary, _args) => cssDiff
  assert.equal(await runCssGuard('origin/main', {}, fakeGit), false)
  assert.equal(await runCssGuard('origin/main', {}, () => ''), true)
  await assert.rejects(() => runCssGuard('--unsafe', {}, fakeGit), /trusted base ref/)
})

test('executes git diff at the repository root, even when CI runs from frontend', async () => {
  let args
  let options
  await runCssGuard('origin/main', {}, (_binary, passedArgs, passedOptions) => {
    args = passedArgs
    options = passedOptions
    return ''
  })
  assert.equal(args.at(-1), 'frontend')
  assert.equal(args.includes('origin/main...HEAD'), true)
  assert.match(options.cwd.replaceAll('\\\\', '/'), /ChatNet.*enforce-tailwind-css-pr-gate-20261122$/i)
})
