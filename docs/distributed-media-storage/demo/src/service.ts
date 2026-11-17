import { createHash, randomUUID, randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decode, encode } from './erasure.ts';
import { Ledger, InsufficientBalanceError, STORAGE_POOL } from './ledger.ts';
import { LocalNetwork, NodeOfflineError, NODE_DOMAINS } from './network.ts';
import type { ShardNetwork } from './network.ts';

export const K = 4;
export const N = 6;
export const CODEC = 'rs-cauchy-gf256-v1';
export const USERS = ['alice', 'bob', 'dave'] as const;

export class DmsError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

export type MediaState = 'RELAY_ACTIVE' | 'DISTRIBUTING' | 'DURABLE_VERIFIED' | 'AT_RISK' | 'ARCHIVED';
export type RecoveryState =
  | 'REQUESTED' | 'QUOTED' | 'RESERVED' | 'LOCATING' | 'FETCHING' | 'RECONSTRUCTED'
  | 'CLIENT_VERIFIED' | 'SETTLED' | 'FAILED' | 'RELEASED';
export type ShardStatus = 'OK' | 'OFFLINE' | 'MISSING' | 'CORRUPT';

export interface Manifest {
  codec: string;
  k: number;
  n: number;
  shardSize: number;
  ciphertextSize: number;
  ciphertextSha256: string;
  shardSha256: string[];
}

interface Media {
  id: string;
  owner: string;
  members: string[];
  manifest: Manifest;
  state: MediaState;
  relayActive: boolean;
  createdAt: string;
  history: { state: MediaState; at: string; reason: string }[];
}

interface Quote {
  id: string;
  mediaId: string;
  userId: string;
  amount: number;
  expiresAt: number;
}

interface RecoveryRequest {
  requestId: string;
  mediaId: string;
  userId: string;
  quoteId: string;
  acceptedAmount: number;
  state: RecoveryState;
  history: { state: RecoveryState; at: string; reason?: string }[];
  servingNodes: number[];
  skipped: { node: number; status: ShardStatus }[];
  ciphertext?: Uint8Array;
  failure?: string;
}

export interface AuditReport {
  shards: { index: number; node: string; domain: string; status: ShardStatus }[];
  healthy: number;
  health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
}

/** Thưởng giữ mảnh mỗi "ngày" (xu): 1 xu / 64 KB, tối thiểu 1. Số MINH HỌA. */
export const storageReward = (shardSize: number) => Math.max(1, Math.ceil(shardSize / (64 * 1024)));
export const STORAGE_POOL_SEED = 5000; // ngân sách giả định

export const priceFor = (ciphertextSize: number) => 100 + 50 * Math.ceil(ciphertextSize / (1024 * 1024)); // xu, công thức demo

export class DmsService {
  readonly net: ShardNetwork;
  day = 0;
  readonly ledger = new Ledger();
  private media = new Map<string, Media>();
  private quotes = new Map<string, Quote>();
  private requests = new Map<string, RecoveryRequest>();
  readonly log: { at: string; msg: string }[] = [];
  private relayDir: string;
  private expiredDir: string;
  readonly root: string;

  constructor(root: string, net?: ShardNetwork) {
    this.root = root;
    mkdirSync(root, { recursive: true });
    this.net = net ?? new LocalNetwork(root, N);
    this.relayDir = join(root, 'relay');
    this.expiredDir = join(root, 'relay-expired');
    mkdirSync(this.relayDir, { recursive: true });
    mkdirSync(this.expiredDir, { recursive: true });
    for (const u of USERS) this.ledger.topup(u, 1000);
    this.ledger.topup(STORAGE_POOL, STORAGE_POOL_SEED);
  }

  private say(msg: string) {
    this.log.push({ at: new Date().toISOString(), msg });
    if (this.log.length > 300) this.log.shift();
  }

  private setState(m: Media, state: MediaState, reason: string) {
    m.state = state;
    m.history.push({ state, at: new Date().toISOString(), reason });
    this.say(`media ${m.id.slice(0, 8)}: ${state} — ${reason}`);
  }

  private getMedia(id: string, user: string): Media {
    const m = this.media.get(id);
    // Không phân biệt "không tồn tại" và "không có quyền" để không lộ sự tồn tại của media.
    if (!m || !m.members.includes(user)) throw new DmsError(403, 'MEDIA_NOT_AUTHORIZED', 'Không có quyền với media này');
    return m;
  }

  // ---------------- Upload & phân phối ----------------
  /** Nhận CIPHERTEXT (đã mã hóa ở client). Server không bao giờ thấy plaintext hay khóa. */
  async upload(owner: string, members: string[], ciphertext: Uint8Array): Promise<Media> {
    for (let i = 0; i < N; i++) {
      if (!(await this.net.isOnline(i))) throw new DmsError(409, 'NOT_ENOUGH_ONLINE_NODES', `node-${i + 1} đang offline, chưa thể phân phối đủ ${N} mảnh`);
    }
    const id = randomUUID();
    const members2 = [...new Set([owner, ...members])];
    writeFileSync(join(this.relayDir, `${id}.bin`), ciphertext);
    const { shards, shardSize } = encode(ciphertext, K, N);
    const manifest: Manifest = {
      codec: CODEC, k: K, n: N, shardSize,
      ciphertextSize: ciphertext.length,
      ciphertextSha256: sha256(ciphertext),
      shardSha256: shards.map(sha256),
    };
    const m: Media = { id, owner, members: members2, manifest, state: 'RELAY_ACTIVE', relayActive: true, createdAt: new Date().toISOString(), history: [] };
    this.media.set(id, m);
    this.setState(m, 'RELAY_ACTIVE', 'đã nhận ciphertext, lưu relay tạm');
    this.setState(m, 'DISTRIBUTING', `chia ${K}-of-${N}, đặt mảnh lên ${N} node`);
    try {
      await Promise.all(shards.map((sh, i) => this.net.put(i, id, sh)));
    } catch (e) {
      if (e instanceof NodeOfflineError) throw new DmsError(409, 'NODE_UNREACHABLE', e.message);
      throw e;
    }
    const drill = await this.recoveryDrill(m);
    if (drill.ok) this.setState(m, 'DURABLE_VERIFIED', `audit đủ ${N}/${N} mảnh, diễn tập khôi phục từ mảnh [${drill.used.map((x) => x + 1).join(',')}] thành công`);
    else this.setState(m, 'AT_RISK', `diễn tập khôi phục thất bại: ${drill.reason}`);
    return m;
  }

  private async readShards(m: Media): Promise<{ shards: Map<number, Uint8Array>; statuses: ShardStatus[] }> {
    const shards = new Map<number, Uint8Array>();
    const statuses = await Promise.all(Array.from({ length: m.manifest.n }, async (_, i): Promise<ShardStatus> => {
      try {
        const b = await this.net.get(i, m.id);
        if (b === null) return 'MISSING';
        if (sha256(b) !== m.manifest.shardSha256[i]) return 'CORRUPT';
        shards.set(i, b);
        return 'OK';
      } catch (e) {
        if (e instanceof NodeOfflineError) return 'OFFLINE';
        throw e;
      }
    }));
    return { shards, statuses };
  }

  /** Audit: kiểm tra từng mảnh bằng hash (không chỉ heartbeat). */
  async audit(mediaId: string, user: string): Promise<AuditReport> {
    return this.auditMedia(this.getMedia(mediaId, user));
  }

  private async auditMedia(m: Media): Promise<AuditReport> {
    const { statuses } = await this.readShards(m);
    const healthy = statuses.filter((s) => s === 'OK').length;
    return {
      shards: statuses.map((status, index) => ({ index, node: `node-${index + 1}`, domain: NODE_DOMAINS[index], status })),
      healthy,
      health: healthy === m.manifest.n ? 'HEALTHY' : healthy >= m.manifest.k ? 'DEGRADED' : 'UNAVAILABLE',
    };
  }

  /** Diễn tập: chọn ngẫu nhiên k mảnh khỏe, dựng lại ciphertext và so hash. */
  private async recoveryDrill(m: Media): Promise<{ ok: boolean; used: number[]; reason: string }> {
    const { shards } = await this.readShards(m);
    const healthy = [...shards.keys()];
    if (healthy.length < m.manifest.k) return { ok: false, used: [], reason: `chỉ còn ${healthy.length}/${m.manifest.k} mảnh khỏe` };
    const pick: number[] = [];
    const pool = [...healthy];
    while (pick.length < m.manifest.k) pick.push(pool.splice(randomInt(pool.length), 1)[0]);
    pick.sort((a, b) => a - b);
    const sel = new Map(pick.map((i) => [i, shards.get(i)!] as const));
    try {
      const out = decode(sel, m.manifest.k, m.manifest.n, m.manifest.ciphertextSize);
      return sha256(out) === m.manifest.ciphertextSha256 ? { ok: true, used: pick, reason: '' } : { ok: false, used: pick, reason: 'hash ciphertext không khớp' };
    } catch (e) {
      return { ok: false, used: pick, reason: (e as Error).message };
    }
  }

  /** Sửa chữa: dựng lại các mảnh hỏng/mất trên node đang online từ các mảnh còn khỏe. */
  async repair(mediaId: string, user: string) {
    const m = this.getMedia(mediaId, user);
    const { shards, statuses } = await this.readShards(m);
    if (shards.size < m.manifest.k) {
      this.say(`repair ${m.id.slice(0, 8)}: thất bại, chỉ còn ${shards.size}/${m.manifest.k} mảnh khỏe`);
      throw new DmsError(409, 'INSUFFICIENT_SHARDS', `Chỉ còn ${shards.size} mảnh khỏe, cần ${m.manifest.k}`);
    }
    const ct = decode(shards, m.manifest.k, m.manifest.n, m.manifest.ciphertextSize);
    if (sha256(ct) !== m.manifest.ciphertextSha256) throw new DmsError(500, 'HASH_MISMATCH', 'Hash ciphertext không khớp sau khi dựng lại');
    const { shards: fresh } = encode(ct, m.manifest.k, m.manifest.n);
    const repaired: number[] = [];
    const stillBad: number[] = [];
    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i] === 'OK') continue;
      if (!(await this.net.isOnline(i))) { stillBad.push(i); continue; }
      await this.net.put(i, m.id, fresh[i]);
      repaired.push(i);
    }
    this.say(`repair ${m.id.slice(0, 8)}: đã dựng lại mảnh [${repaired.map((x) => x + 1).join(',') || '-'}]${stillBad.length ? `, node offline chưa sửa được [${stillBad.map((x) => x + 1).join(',')}]` : ''}`);
    if (m.relayActive && m.state === 'AT_RISK' && !stillBad.length) this.setState(m, 'DURABLE_VERIFIED', 'đã sửa chữa đủ mảnh');
    return { repaired: repaired.map((x) => x + 1), stillBad: stillBad.map((x) => x + 1) };
  }

  /** Điều kiện được phép "hết hạn relay" (mô phỏng xóa S3/R2). Không đạt thì giữ relay. */
  async evaluateArchive(mediaId: string, user: string) {
    const m = this.getMedia(mediaId, user);
    if (!m.relayActive) return { archived: true, reasons: ['relay đã hết hạn từ trước'] };
    const reasons: string[] = [];
    const a = await this.auditMedia(m);
    if (a.healthy < m.manifest.n) reasons.push(`audit chỉ đạt ${a.healthy}/${m.manifest.n} mảnh`);
    const perDomain = new Map<string, number>();
    for (const s of a.shards.filter((x) => x.status === 'OK')) perDomain.set(s.domain, (perDomain.get(s.domain) ?? 0) + 1);
    if (perDomain.size < 3) reasons.push(`mới có ${perDomain.size} failure domain khỏe, cần >= 3`);
    for (const [d, c] of perDomain) if (c > m.manifest.n - m.manifest.k) reasons.push(`domain ${d} giữ ${c} mảnh, vượt ngưỡng ${m.manifest.n - m.manifest.k}`);
    const drill = await this.recoveryDrill(m);
    if (!drill.ok) reasons.push(`diễn tập khôi phục thất bại: ${drill.reason}`);
    if (reasons.length) {
      this.setState(m, 'AT_RISK', `KHÔNG hết hạn relay: ${reasons.join('; ')}`);
      return { archived: false, reasons };
    }
    renameSync(join(this.relayDir, `${m.id}.bin`), join(this.expiredDir, `${m.id}.bin`));
    m.relayActive = false;
    this.setState(m, 'ARCHIVED', 'đủ điều kiện: audit đủ mảnh, đa failure domain, diễn tập khôi phục đạt; relay đã hết hạn (chuyển sang relay-expired/, mô phỏng)');
    return { archived: true, reasons: [] };
  }

  // ---------------- Tải thường (relay còn hạn: miễn phí) ----------------
  downloadRelay(mediaId: string, user: string): Uint8Array {
    const m = this.getMedia(mediaId, user);
    if (!m.relayActive) throw new DmsError(410, 'RELAY_EXPIRED', 'Bản tạm đã hết hạn, hãy dùng "Truy cập lại"');
    return new Uint8Array(readFileSync(join(this.relayDir, `${m.id}.bin`)));
  }

  // ---------------- Truy cập lại có thu phí ----------------
  async quote(mediaId: string, user: string) {
    const m = this.getMedia(mediaId, user);
    if (m.relayActive) return { kind: 'FREE_RELAY' as const, message: 'Bản tạm còn hạn, tải thường, không tính phí.' };
    const a = await this.auditMedia(m);
    if (a.healthy < m.manifest.k) {
      return { kind: 'UNAVAILABLE' as const, code: 'INSUFFICIENT_SHARDS', healthyShards: a.healthy, needed: m.manifest.k, message: `Chỉ còn ${a.healthy} mảnh khỏe, cần ít nhất ${m.manifest.k}. Không thể khôi phục, không thu phí.` };
    }
    const q: Quote = { id: randomUUID(), mediaId, userId: user, amount: priceFor(m.manifest.ciphertextSize), expiresAt: Date.now() + 120_000 };
    this.quotes.set(q.id, q);
    this.say(`báo giá ${q.id.slice(0, 8)} cho ${user}: ${q.amount} xu (chưa trừ tiền)`);
    return { kind: 'QUOTE' as const, quoteId: q.id, amount: q.amount, unit: 'xu (demo)', expiresAt: new Date(q.expiresAt).toISOString(), healthyShards: a.healthy, needed: m.manifest.k };
  }

  private rec(r: RecoveryRequest, state: RecoveryState, reason?: string) {
    r.state = state;
    r.history.push({ state, at: new Date().toISOString(), reason });
    this.say(`request ${r.requestId.slice(0, 8)}: ${state}${reason ? ` — ${reason}` : ''}`);
  }

  async reaccess(mediaId: string, user: string, body: { requestId: string; quoteId: string; acceptedAmount: number }) {
    const m = this.getMedia(mediaId, user);
    const { requestId, quoteId, acceptedAmount } = body;
    if (!requestId) throw new DmsError(400, 'BAD_REQUEST', 'Thiếu requestId');
    const existing = this.requests.get(requestId);
    if (existing) {
      if (existing.mediaId !== mediaId || existing.userId !== user || existing.quoteId !== quoteId || existing.acceptedAmount !== acceptedAmount) {
        throw new DmsError(409, 'IDEMPOTENCY_CONFLICT', 'requestId đã dùng với nội dung khác');
      }
      this.say(`request ${requestId.slice(0, 8)}: gửi lại cùng requestId, trả kết quả cũ, KHÔNG xử lý/tính tiền lần nữa`);
      return this.view(existing, true);
    }
    if (m.relayActive) throw new DmsError(409, 'RELAY_STILL_ACTIVE', 'Bản tạm còn hạn, hãy tải thường (miễn phí)');
    const q = this.quotes.get(quoteId);
    if (!q || q.userId !== user || q.mediaId !== mediaId) throw new DmsError(409, 'QUOTE_NOT_FOUND', 'Báo giá không hợp lệ');
    if (Date.now() > q.expiresAt) throw new DmsError(409, 'QUOTE_EXPIRED', 'Báo giá đã hết hạn');
    if (acceptedAmount !== q.amount) throw new DmsError(409, 'PRICE_MISMATCH', `Số tiền xác nhận (${acceptedAmount}) khác báo giá (${q.amount}); server kiểm tra giá phía server`);
    const r: RecoveryRequest = { requestId, mediaId, userId: user, quoteId, acceptedAmount, state: 'REQUESTED', history: [], servingNodes: [], skipped: [] };
    this.requests.set(requestId, r);
    this.rec(r, 'REQUESTED');
    this.rec(r, 'QUOTED', `${q.amount} xu`);
    try {
      this.ledger.reserve(user, requestId, q.amount);
    } catch (e) {
      this.requests.delete(requestId);
      if (e instanceof InsufficientBalanceError) throw new DmsError(402, 'INSUFFICIENT_BALANCE', 'Không đủ số dư');
      throw e;
    }
    this.rec(r, 'RESERVED', 'đã giữ tiền (chưa trừ)');
    this.rec(r, 'LOCATING');
    const { shards, statuses } = await this.readShards(m);
    statuses.forEach((s, node) => s !== 'OK' && r.skipped.push({ node: node + 1, status: s }));
    this.rec(r, 'FETCHING', `${shards.size}/${m.manifest.n} mảnh dùng được${r.skipped.length ? `, bỏ qua ${r.skipped.map((x) => `node-${x.node}:${x.status}`).join(', ')}` : ''}`);
    if (shards.size < m.manifest.k) return this.fail(r, `chỉ còn ${shards.size}/${m.manifest.k} mảnh khỏe`);
    const used = [...shards.keys()].sort((a, b) => a - b).slice(0, m.manifest.k);
    let ct: Uint8Array;
    try {
      ct = decode(new Map(used.map((i) => [i, shards.get(i)!] as const)), m.manifest.k, m.manifest.n, m.manifest.ciphertextSize);
    } catch (e) {
      return this.fail(r, (e as Error).message);
    }
    if (sha256(ct) !== m.manifest.ciphertextSha256) return this.fail(r, 'hash ciphertext không khớp sau khi ghép');
    r.servingNodes = used;
    r.ciphertext = ct;
    this.rec(r, 'RECONSTRUCTED', `ghép từ mảnh của node [${used.map((x) => x + 1).join(',')}], hash khớp; chờ client giải mã & xác nhận`);
    return this.view(r, false);
  }

  private fail(r: RecoveryRequest, reason: string) {
    r.failure = reason;
    this.rec(r, 'FAILED', reason);
    this.ledger.release(r.requestId, `hoàn tiền: ${reason}`);
    this.rec(r, 'RELEASED', 'đã hoàn khoản giữ, không thu phí');
    return this.view(r, false);
  }

  /** Client báo giải mã được (ok) hay không. Chỉ khi ok mới settle, và đúng một lần. */
  clientReceipt(requestId: string, user: string, ok: boolean) {
    const r = this.requests.get(requestId);
    if (!r || r.userId !== user) throw new DmsError(403, 'MEDIA_NOT_AUTHORIZED', 'Không có quyền');
    if (r.state === 'SETTLED' || r.state === 'RELEASED') {
      this.say(`request ${requestId.slice(0, 8)}: nhận receipt lặp, bỏ qua (đã ${r.state})`);
      return this.view(r, true);
    }
    if (r.state !== 'RECONSTRUCTED') throw new DmsError(409, 'BAD_STATE', `Trạng thái ${r.state} không nhận receipt`);
    if (ok) {
      this.rec(r, 'CLIENT_VERIFIED', 'client đã giải mã & kiểm tra AEAD thành công');
      this.ledger.settle(requestId, r.servingNodes.map((i) => `node-${i + 1}`));
      this.rec(r, 'SETTLED', `đã tính phí ${r.acceptedAmount} xu (một lần) và ghi thưởng cho node phục vụ`);
    } else {
      this.fail(r, 'client không giải mã được (sai/mất khóa hoặc dữ liệu hỏng)');
    }
    r.ciphertext = undefined;
    return this.view(r, false);
  }

  cancel(requestId: string, user: string) {
    const r = this.requests.get(requestId);
    if (!r || r.userId !== user) throw new DmsError(403, 'MEDIA_NOT_AUTHORIZED', 'Không có quyền');
    if (r.state === 'SETTLED') throw new DmsError(409, 'ALREADY_SETTLED', 'Đã quyết toán, không thể hủy');
    if (r.state === 'RELEASED') return this.view(r, true);
    this.ledger.release(requestId, 'người dùng hủy');
    this.rec(r, 'RELEASED', 'người dùng hủy, đã hoàn khoản giữ');
    r.ciphertext = undefined;
    return this.view(r, false);
  }

  private view(r: RecoveryRequest, replay: boolean) {
    return {
      requestId: r.requestId, mediaId: r.mediaId, state: r.state, replay,
      amount: r.acceptedAmount, failure: r.failure ?? null,
      servingNodes: r.servingNodes.map((x) => x + 1), skipped: r.skipped,
      history: r.history,
      ciphertextB64: r.ciphertext && r.state === 'RECONSTRUCTED' ? Buffer.from(r.ciphertext).toString('base64') : undefined,
    };
  }

  // ---------------- Mô phỏng sự cố (phục vụ demo) ----------------
  async nodeAction(index: number, action: string, mediaId?: string) {
    if (!(index >= 0 && index < N)) throw new DmsError(400, 'BAD_REQUEST', 'node không hợp lệ');
    if (action !== 'offline' && action !== 'online' && action !== 'tamper' && action !== 'lose') throw new DmsError(400, 'BAD_REQUEST', 'action không hợp lệ');
    if ((action === 'tamper' || action === 'lose') && !mediaId) throw new DmsError(400, 'BAD_REQUEST', 'cần chọn media');
    let ok: boolean;
    try {
      ok = await this.net.admin(index, action, mediaId);
    } catch (e) {
      if (e instanceof NodeOfflineError) throw new DmsError(409, 'NODE_UNREACHABLE', e.message);
      throw e;
    }
    if (!ok) throw new DmsError(409, 'NO_SHARD', 'node không có mảnh của media này');
    this.say(`[sự cố mô phỏng] node-${index + 1}: ${action}${mediaId ? ` (media ${mediaId.slice(0, 8)})` : ''}`);
  }

  // ---------------- Trạng thái tổng cho UI ----------------
  /** Qua 1 "ngày" (mô phỏng): node chỉ được thưởng cho mảnh vượt kiểm tra hash. */
  async advanceDay() {
    this.day += 1;
    let paid = 0;
    const perNode: Record<string, number> = {};
    const skipped: { node: string; media: string; status: string }[] = [];
    let poolEmpty = false;
    for (const m of this.media.values()) {
      const { statuses } = await this.readShards(m);
      statuses.forEach((st, i) => {
        const node = `node-${i + 1}`;
        if (st !== 'OK') return void skipped.push({ node, media: m.id.slice(0, 8), status: st });
        const amt = storageReward(m.manifest.shardSize);
        if (this.ledger.payStorage(node, amt, `ngày ${this.day}: giữ mảnh ${m.id.slice(0, 8)} (đạt hash)`)) {
          paid += amt;
          perNode[node] = (perNode[node] ?? 0) + amt;
        } else poolEmpty = true;
      });
    }
    this.say(`qua ngày ${this.day}: trả ${paid} xu thưởng giữ mảnh${skipped.length ? `; không thưởng ${skipped.map((x) => `${x.node}(${x.status})`).join(', ')}` : ''}${poolEmpty ? '; QUỸ THƯỞNG HẾT' : ''}`);
    return { day: this.day, paid, perNode, skipped, poolEmpty };
  }

  async snapshot(user: string) {
    const info = await this.net.describe();
    const earned = this.ledger.rewards().nodes;
    const media = await Promise.all([...this.media.values()].filter((m) => m.members.includes(user)).map(async (m) => ({
      id: m.id, owner: m.owner, members: m.members, state: m.state, relayActive: m.relayActive,
      ciphertextSize: m.manifest.ciphertextSize, shardSize: m.manifest.shardSize, history: m.history,
      audit: await this.auditMedia(m), price: priceFor(m.manifest.ciphertextSize),
    })));
    return {
      user,
      params: { k: K, n: N, codec: CODEC },
      day: this.day,
      pool: this.ledger.wallet(STORAGE_POOL).available,
      nodes: info.map((n) => ({ ...n, earned: earned[n.name] ?? 0 })),
      media,
      wallets: this.ledger.wallets_(),
      rewards: this.ledger.rewards(),
      invariant: this.ledger.checkInvariant(),
      ledger: this.ledger.entries.slice(-25),
      log: this.log.slice(-60),
      existsRelayExpired: existsSync(this.expiredDir),
    };
  }
}
