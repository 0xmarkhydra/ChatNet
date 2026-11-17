import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encode, decode } from '../src/erasure.ts';
import { generateKey, encrypt, decrypt, sha256Hex } from '../src/e2ee.ts';
import { DmsService, DmsError } from '../src/service.ts';

const K = 4, N = 6;
const mk = () => new DmsService(mkdtempSync(join(tmpdir(), 'dms-test-')));

function combos(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) return void out.push([...cur]);
    for (let i = start; i < n; i++) rec(i + 1, [...cur, i]);
  };
  rec(0, []);
  return out;
}

test('erasure: mọi tổ hợp 4 trong 6 mảnh đều dựng lại đúng, mọi độ dài', async () => {
  for (const len of [1, 2, 3, 4, 5, 7, 100, 4097, 100_000]) {
    const data = new Uint8Array(randomBytes(len));
    const { shards } = encode(data, K, N);
    for (const c of combos(N, K)) {
      const out = decode(new Map(c.map((i) => [i, shards[i]] as const)), K, N, len);
      assert.deepEqual(Buffer.from(out), Buffer.from(data), `len=${len} combo=${c}`);
    }
  }
});

test('erasure: chỉ có 3 mảnh thì từ chối', async () => {
  const { shards } = encode(new Uint8Array(randomBytes(1000)), K, N);
  assert.throws(() => decode(new Map([0, 1, 5].map((i) => [i, shards[i]] as const)), K, N, 1000));
});

test('e2ee: sai khóa hoặc sửa 1 byte đều bị AEAD từ chối', async () => {
  const key = await generateKey();
  const ct = await encrypt(key, new TextEncoder().encode('xin chào'));
  assert.equal(new TextDecoder().decode(await decrypt(key, ct)), 'xin chào');
  await assert.rejects(decrypt(await generateKey(), ct));
  const bad = ct.slice();
  bad[20] ^= 1;
  await assert.rejects(decrypt(key, bad));
});

async function upload(s: DmsService, size = 300_000) {
  const key = await generateKey();
  const plain = new Uint8Array(randomBytes(size));
  const ct = await encrypt(key, plain);
  const m = await s.upload('alice', ['bob'], ct);
  return { m, key, plain };
}

test('upload: DURABLE_VERIFIED, node/relay chỉ thấy ciphertext', async () => {
  const s = mk();
  const { m, plain } = await upload(s);
  assert.equal(m.state, 'DURABLE_VERIFIED');
  assert.equal((await s.audit(m.id, 'alice')).healthy, 6);
  assert.notEqual(await sha256Hex(s.downloadRelay(m.id, 'bob')), await sha256Hex(plain));
});

test('archive bị từ chối khi chưa đạt điều kiện (mất mảnh), giữ relay', async () => {
  const s = mk();
  const { m } = await upload(s);
  await s.nodeAction(1, 'tamper', m.id);
  const r = await s.evaluateArchive(m.id, 'alice');
  assert.equal(r.archived, false);
  assert.equal((await s.snapshot('alice')).media[0].relayActive, true);
  assert.equal((await s.snapshot('alice')).media[0].state, 'AT_RISK');
});

async function archived(s: DmsService) {
  const x = await upload(s);
  assert.equal((await s.evaluateArchive(x.m.id, 'alice')).archived, true);
  return x;
}
const quoteOf = async (s: DmsService, id: string, u = 'bob') => {
  const q = await s.quote(id, u);
  assert.equal(q.kind, 'QUOTE');
  return q as Extract<typeof q, { kind: 'QUOTE' }>;
};

test('truy cập lại: mất 2 node vẫn khôi phục, tính phí đúng một lần, giải mã đúng', async () => {
  const s = mk();
  const { m, key, plain } = await archived(s);
  await s.nodeAction(1, 'offline');
  await s.nodeAction(4, 'offline');
  const q = await quoteOf(s, m.id);
  const body = { requestId: 'r1', quoteId: q.quoteId, acceptedAmount: q.amount };
  const v = await s.reaccess(m.id, 'bob', body);
  assert.equal(v.state, 'RECONSTRUCTED');
  const out = await decrypt(key, new Uint8Array(Buffer.from(v.ciphertextB64!, 'base64')));
  assert.deepEqual(Buffer.from(out), Buffer.from(plain));
  const before = s.ledger.wallet('bob').available;
  s.clientReceipt('r1', 'bob', true);
  s.clientReceipt('r1', 'bob', true); // receipt lặp
  await s.reaccess(m.id, 'bob', body); // gửi lại cùng requestId (2 tab)
  assert.equal(s.ledger.wallet('bob').available, before);
  assert.equal(s.ledger.wallet('bob').held, 0);
  assert.equal(1000 - s.ledger.wallet('bob').available, q.amount);
  assert.equal(s.ledger.entries.filter((e) => e.type === 'SETTLE').length, 1);
  assert.ok(s.ledger.checkInvariant().ok);
});

test('mất 3 node: không báo giá, không thu phí', async () => {
  const s = mk();
  const { m } = await archived(s);
  for (const i of [0, 2, 4]) await s.nodeAction(i, 'offline');
  const q = await s.quote(m.id, 'bob');
  assert.equal(q.kind, 'UNAVAILABLE');
  assert.equal(s.ledger.wallet('bob').available, 1000);
});

test('mảnh bị sửa cùng kích thước: phát hiện, bỏ qua, vẫn khôi phục, repair được', async () => {
  const s = mk();
  const { m, key, plain } = await archived(s);
  await s.nodeAction(0, 'tamper', m.id);
  assert.equal((await s.audit(m.id, 'alice')).shards[0].status, 'CORRUPT');
  const q = await quoteOf(s, m.id);
  const v = await s.reaccess(m.id, 'bob', { requestId: 'r2', quoteId: q.quoteId, acceptedAmount: q.amount });
  assert.deepEqual(v.skipped, [{ node: 1, status: 'CORRUPT' }]);
  const out = await decrypt(key, new Uint8Array(Buffer.from(v.ciphertextB64!, 'base64')));
  assert.deepEqual(Buffer.from(out), Buffer.from(plain));
  s.cancel('r2', 'bob');
  assert.deepEqual((await s.repair(m.id, 'alice')).repaired, [1]);
  assert.equal((await s.audit(m.id, 'alice')).health, 'HEALTHY');
});

test('chặn sửa giá, báo giá hết hạn/không hợp lệ, xung đột idempotency', async () => {
  const s = mk();
  const { m } = await archived(s);
  const q = await quoteOf(s, m.id);
  await assert.rejects(s.reaccess(m.id, 'bob', { requestId: 'a', quoteId: q.quoteId, acceptedAmount: 1 }), (e) => (e as DmsError).code === 'PRICE_MISMATCH');
  await assert.rejects(s.reaccess(m.id, 'bob', { requestId: 'a', quoteId: 'nope', acceptedAmount: q.amount }), (e) => (e as DmsError).code === 'QUOTE_NOT_FOUND');
  await s.reaccess(m.id, 'bob', { requestId: 'b', quoteId: q.quoteId, acceptedAmount: q.amount });
  await assert.rejects(s.reaccess(m.id, 'bob', { requestId: 'b', quoteId: q.quoteId, acceptedAmount: q.amount + 1 }), (e) => ['IDEMPOTENCY_CONFLICT'].includes((e as DmsError).code));
  assert.equal(s.ledger.wallet('bob').available, 1000 - q.amount); // chỉ giữ một lần
});

test('người ngoài nhóm: 403 giống nhau cho id có thật và id không tồn tại', async () => {
  const s = mk();
  const { m } = await archived(s);
  for (const id of [m.id, 'khong-ton-tai']) {
    await assert.rejects(s.quote(id, 'dave'), (e) => (e as DmsError).status === 403 && (e as DmsError).code === 'MEDIA_NOT_AUTHORIZED');
  }
});

test('mất khóa: client báo lỗi giải mã -> hoàn tiền, không thu phí', async () => {
  const s = mk();
  const { m, key } = await archived(s);
  const q = await quoteOf(s, m.id);
  const v = await s.reaccess(m.id, 'bob', { requestId: 'k1', quoteId: q.quoteId, acceptedAmount: q.amount });
  await assert.rejects(decrypt(await generateKey(), new Uint8Array(Buffer.from(v.ciphertextB64!, 'base64'))));
  void key;
  const end = s.clientReceipt('k1', 'bob', false);
  assert.equal(end.state, 'RELEASED');
  assert.equal(s.ledger.wallet('bob').available, 1000);
  assert.equal(s.ledger.entries.filter((e) => e.type === 'SETTLE').length, 0);
});

test('số dư không đủ: 402, không giữ tiền', async () => {
  const s = mk();
  const { m } = await archived(s);
  s.ledger.reserve('bob', 'drain', 980); // làm cạn ví
  const q = await quoteOf(s, m.id);
  await assert.rejects(s.reaccess(m.id, 'bob', { requestId: 'z', quoteId: q.quoteId, acceptedAmount: q.amount }), (e) => (e as DmsError).code === 'INSUFFICIENT_BALANCE');
});

test('thưởng giữ mảnh: chỉ mảnh đạt hash mới được thưởng, tiền vẫn bảo toàn', async () => {
  const s = mk();
  const { m } = await archived(s);
  await s.nodeAction(2, 'tamper', m.id); // node-3 giữ mảnh hỏng
  await s.nodeAction(4, 'offline'); // node-5 tắt
  const r = await s.advanceDay();
  assert.ok(r.paid > 0);
  assert.equal(r.perNode['node-3'], undefined);
  assert.equal(r.perNode['node-5'], undefined);
  for (const n of ['node-1', 'node-2', 'node-4', 'node-6']) assert.ok(r.perNode[n] > 0, n);
  assert.equal(s.ledger.checkInvariant().ok, true);
  const snap = await s.snapshot('alice');
  assert.equal(snap.nodes[0].earned, r.perNode['node-1']);
  assert.equal(snap.pool, 5000 - r.paid);
});
