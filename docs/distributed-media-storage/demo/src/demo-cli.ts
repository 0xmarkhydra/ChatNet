// Chạy: npm run demo  — kịch bản dòng lệnh, in từng bước để trình bày.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DmsService, DmsError } from './service.ts';
import { generateKey, encrypt, decrypt, sha256Hex } from './e2ee.ts';

const H = (t: string) => console.log(`\n\x1b[1;36m=== ${t} ===\x1b[0m`);
const ok = (t: string) => console.log(`  \x1b[32m✔\x1b[0m ${t}`);
const no = (t: string) => console.log(`  \x1b[31m✘\x1b[0m ${t}`);
const info = (t: string) => console.log(`  • ${t}`);

async function fresh() {
  const s = new DmsService(mkdtempSync(join(tmpdir(), 'dms-cli-')));
  const key = await generateKey();
  const plain = new Uint8Array(randomBytes(2 * 1024 * 1024 + 123));
  const ct = await encrypt(key, plain);
  const m = await s.upload('alice', ['bob'], ct);
  return { s, key, plain, m, plainSha: await sha256Hex(plain) };
}
const states = async (s: DmsService, id: string) => (await s.snapshot('alice')).media.find((x) => x.id === id)!;
const bal = (s: DmsService, u: string) => `${s.ledger.wallet(u).available} xu (giữ ${s.ledger.wallet(u).held})`;

async function reaccess(s: DmsService, id: string, key: CryptoKey, plainSha: string, requestId: string, user = 'bob') {
  const q = await s.quote(id, user);
  if (q.kind !== 'QUOTE') return no(`không báo giá: ${q.kind === 'UNAVAILABLE' ? q.message : q.kind} → không thu phí (số dư ${bal(s, user)})`);
  info(`báo giá ${q.amount} xu, số dư trước: ${bal(s, user)}`);
  const v = await s.reaccess(id, user, { requestId, quoteId: q.quoteId, acceptedAmount: q.amount });
  info(`trạng thái: ${v.history.map((h) => h.state).join(' → ')}`);
  if (v.skipped.length) info(`bỏ qua: ${v.skipped.map((x) => `node-${x.node}:${x.status}`).join(', ')}`);
  if (v.state !== 'RECONSTRUCTED') return no(`thất bại: ${v.failure} → đã hoàn, số dư ${bal(s, user)}`);
  try {
    const out = await decrypt(key, new Uint8Array(Buffer.from(v.ciphertextB64!, 'base64')));
    (await sha256Hex(out)) === plainSha ? ok('client giải mã OK, hash trùng file gốc') : no('hash lệch!');
    const end = s.clientReceipt(requestId, user, true);
    ok(`kết thúc: ${end.state}, số dư sau: ${bal(s, user)}`);
  } catch {
    const end = s.clientReceipt(requestId, user, false);
    no(`client không giải mã được → ${end.state}, số dư ${bal(s, user)} (không thu phí)`);
  }
}

H('1. Gửi file: mã hóa ở client, chia 4-of-6, đặt lên 6 node, diễn tập khôi phục');
{
  const { s, m } = await fresh();
  const a = (await states(s, m.id)).audit;
  ok(`trạng thái: ${m.history.map((h) => h.state).join(' → ')}`);
  info(`audit: ${a.shards.map((x) => `${x.node}:${x.status}`).join('  ')}`);
}

H('2. Hết hạn relay (chỉ khi đủ điều kiện) rồi mất 2 node → vẫn truy cập lại được, tính phí 1 lần');
{
  const { s, m, key, plainSha } = await fresh();
  const r = await s.evaluateArchive(m.id, 'alice');
  r.archived ? ok('relay hết hạn (mô phỏng) vì đủ điều kiện an toàn') : no(r.reasons.join('; '));
  await s.nodeAction(1, 'offline'); await s.nodeAction(4, 'offline');
  info('node-2 và node-5 offline');
  await reaccess(s, m.id, key, plainSha, 'req-A');
  info(`bảo toàn tiền: ${s.ledger.checkInvariant().ok ? 'ĐÚNG' : 'SAI'} (${s.ledger.checkInvariant().detail})`);
}

H('3. Mất 3 node → không đủ mảnh, KHÔNG thu phí');
{
  const { s, m, key, plainSha } = await fresh();
  await s.evaluateArchive(m.id, 'alice');
  for (const i of [0, 2, 4]) await s.nodeAction(i, 'offline');
  info('node-1, node-3, node-5 offline');
  await reaccess(s, m.id, key, plainSha, 'req-B');
}

H('4. Một mảnh bị sửa (cùng kích thước) → hash phát hiện, bỏ qua, khôi phục từ mảnh khác, rồi repair');
{
  const { s, m, key, plainSha } = await fresh();
  await s.evaluateArchive(m.id, 'alice');
  await s.nodeAction(0, 'tamper', m.id);
  info(`audit: ${(await s.audit(m.id, 'alice')).shards.map((x) => `${x.node}:${x.status}`).join('  ')}`);
  await reaccess(s, m.id, key, plainSha, 'req-C');
  const rp = await s.repair(m.id, 'alice');
  ok(`repair dựng lại mảnh node [${rp.repaired.join(',')}] → ${(await s.audit(m.id, 'alice')).health}`);
}

H('5. Gửi trùng yêu cầu (2 tab / retry) → chỉ tính tiền một lần');
{
  const { s, m, key, plainSha } = await fresh();
  await s.evaluateArchive(m.id, 'alice');
  const q = await s.quote(m.id, 'bob');
  if (q.kind !== 'QUOTE') throw new Error('cần báo giá');
  const body = { requestId: 'req-D', quoteId: q.quoteId, acceptedAmount: q.amount };
  for (let i = 1; i <= 3; i++) await s.reaccess(m.id, 'bob', body);
  info(`gọi reaccess 3 lần cùng requestId, đang giữ: ${bal(s, 'bob')}`);
  const out = await decrypt(key, new Uint8Array(Buffer.from((await s.reaccess(m.id, 'bob', body)).ciphertextB64!, 'base64')));
  s.clientReceipt('req-D', 'bob', (await sha256Hex(out)) === plainSha);
  s.clientReceipt('req-D', 'bob', true);
  ok(`sau receipt (gửi 2 lần): ${bal(s, 'bob')} — số bút toán SETTLE: ${s.ledger.entries.filter((e) => e.type === 'SETTLE').length}`);
  try { await s.reaccess(m.id, 'bob', { ...body, requestId: 'req-E', acceptedAmount: 1 }); } catch (e) { ok(`sửa giá bị chặn: ${(e as DmsError).code}`); }
  try { await s.quote(m.id, 'dave'); } catch (e) { ok(`người ngoài nhóm bị chặn: ${(e as DmsError).status} ${(e as DmsError).code}`); }
}

H('6. Mất khóa giải mã → client báo lỗi → hoàn tiền');
{
  const { s, m, plainSha } = await fresh();
  await s.evaluateArchive(m.id, 'alice');
  await reaccess(s, m.id, await generateKey(), plainSha, 'req-F');
}

H('7. Chưa đủ điều kiện thì KHÔNG hết hạn relay');
{
  const { s, m } = await fresh();
  await s.nodeAction(2, 'tamper', m.id);
  const r = await s.evaluateArchive(m.id, 'alice');
  r.archived ? no('lẽ ra phải từ chối') : ok(`từ chối: ${r.reasons.join('; ')}; trạng thái ${(await states(s, m.id)).state}, relay còn: ${(await states(s, m.id)).relayActive}`);
}
H('8. Node kiếm tiền vì GIỮ mảnh (qua ngày): chỉ mảnh đạt hash mới được thưởng');
{
  const { s, m } = await fresh();
  await s.evaluateArchive(m.id, 'alice');
  await s.nodeAction(2, 'tamper', m.id);
  await s.nodeAction(4, 'offline');
  info('node-3 giữ mảnh bị hỏng, node-5 tạm dừng');
  const r = await s.advanceDay();
  info(`ngày ${r.day}: trả ${r.paid} xu từ quỹ; mỗi node: ${Object.entries(r.perNode).map(([n, v]) => `${n}=${v}`).join(', ')}`);
  ok(`không thưởng: ${r.skipped.map((x) => `${x.node}(${x.status})`).join(', ')}`);
  info(`bảo toàn tiền: ${s.ledger.checkInvariant().ok ? 'ĐÚNG' : 'SAI'}`);
}
console.log('\nXong. Mọi dữ liệu là giả lập; đây là POC, không phải sản phẩm.\n');
