import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { startAgent } from '../src/agent.ts';
import { RemoteNetwork } from '../src/network.ts';
import { DmsService } from '../src/service.ts';
import { generateKey, encrypt, decrypt } from '../src/e2ee.ts';

async function cluster() {
  const base = mkdtempSync(join(tmpdir(), 'dms-agents-'));
  const agents = await Promise.all(Array.from({ length: 6 }, (_, i) => startAgent({ name: `node-${i + 1}`, dir: join(base, `n${i + 1}`), port: 0 })));
  const net = new RemoteNetwork(agents.map((a) => `http://127.0.0.1:${a.port}`));
  return { base, agents, net, svc: new DmsService(mkdtempSync(join(tmpdir(), 'dms-svc-')), net) };
}

test('agent qua HTTP thật: gửi, hết hạn relay, tắt 2 agent, khôi phục, giải mã đúng', async () => {
  const { agents, svc } = await cluster();
  try {
    const key = await generateKey();
    const plain = new Uint8Array(randomBytes(200_000));
    const m = await svc.upload('alice', ['bob'], await encrypt(key, plain));
    assert.equal(m.state, 'DURABLE_VERIFIED');
    assert.equal((await svc.evaluateArchive(m.id, 'alice')).archived, true);
    // một agent thật sự bị đóng (mất kết nối) + một agent tạm dừng
    await agents[1].close();
    await svc.nodeAction(4, 'offline');
    const q = await svc.quote(m.id, 'bob');
    assert.equal(q.kind, 'QUOTE');
    if (q.kind !== 'QUOTE') return;
    const v = await svc.reaccess(m.id, 'bob', { requestId: 'net1', quoteId: q.quoteId, acceptedAmount: q.amount });
    assert.equal(v.state, 'RECONSTRUCTED');
    assert.deepEqual(v.skipped.map((x) => x.node), [2, 5]);
    const out = await decrypt(key, new Uint8Array(Buffer.from(v.ciphertextB64!, 'base64')));
    assert.deepEqual(Buffer.from(out), Buffer.from(plain));
    const info = await svc.net.describe();
    assert.equal(info[1].reachable, false); // agent đã đóng
    assert.equal(info[4].reachable, true);
    assert.equal(info[4].online, false); // tạm dừng
  } finally {
    await Promise.all(agents.map((a) => a.close().catch(() => undefined)));
  }
});

test('agent: chỉ nhận id hợp lệ (chặn path traversal), reset không xóa mảnh', async () => {
  const { base, agents, net } = await cluster();
  try {
    assert.equal(await net.get(0, '../../etc/passwd'), null); // id lạ bị từ chối, không đọc được file ngoài thư mục
    assert.equal(await net.get(0, '..%2F..%2Fetc%2Fpasswd'), null);
    const id = '11111111-2222-3333-4444-555555555555';
    await net.put(0, id, new Uint8Array([1, 2, 3]));
    assert.deepEqual([...(await net.get(0, id))!], [1, 2, 3]);
    await net.resetAll();
    assert.equal(await net.get(0, id), null);
    const dirs = readdirSync(join(base, 'n1'));
    assert.ok(dirs.some((d) => d.startsWith('archive-'))); // mảnh cũ được cất, không xóa
  } finally {
    await Promise.all(agents.map((a) => a.close()));
  }
});
