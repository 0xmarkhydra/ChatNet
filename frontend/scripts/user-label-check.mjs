import assert from 'node:assert/strict'
import { userLabel } from '../src/shared/lib/userLabel.ts'

assert.equal(userLabel('  Lê Minh An  ', 'minhan'), 'Lê Minh An')
assert.equal(userLabel('', 'minhan'), 'minhan')
assert.equal(userLabel('  ', 'minhan'), 'minhan')
assert.equal(userLabel(undefined, 'legacy_user'), 'legacy_user')
assert.equal(userLabel(undefined, undefined), 'Người dùng')
assert.equal(userLabel('Nguyễn An', 'account_a'), userLabel('Nguyễn An', 'account_b'))
console.log('PASS: Unicode display labels, whitespace, missing legacy fields and duplicate labels')
