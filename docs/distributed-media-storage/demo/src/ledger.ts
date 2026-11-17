// Sổ giao dịch GIẢ LẬP (không phải tiền thật). Đơn vị: "xu" (100 xu = 1.00 COIN demo).
// Mục tiêu: reserve -> settle đúng một lần, release/hoàn khi lỗi, idempotent theo requestId.

export type EntryType = 'TOPUP' | 'RESERVE' | 'SETTLE' | 'RELEASE' | 'NODE_REWARD' | 'PLATFORM_FEE' | 'STORAGE_REWARD';

/** Quỹ thưởng lưu trữ (ngân sách GIẢ ĐỊNH; ai nạp quỹ này là câu hỏi mở với mentor). */
export const STORAGE_POOL = 'storage-pool';

export interface LedgerEntry {
  id: number;
  at: string;
  type: EntryType;
  userId: string;
  requestId: string;
  amount: number;
  note?: string;
}

export interface Wallet {
  available: number;
  held: number;
}

export class InsufficientBalanceError extends Error {}

type HoldState = 'RESERVED' | 'SETTLED' | 'RELEASED';

export class Ledger {
  readonly entries: LedgerEntry[] = [];
  private wallets = new Map<string, Wallet>();
  private holds = new Map<string, { userId: string; amount: number; state: HoldState }>();
  private nodeRewards = new Map<string, number>();
  private platform = 0;
  private totalTopup = 0;

  private add(type: EntryType, userId: string, requestId: string, amount: number, note?: string) {
    this.entries.push({ id: this.entries.length + 1, at: new Date().toISOString(), type, userId, requestId, amount, note });
  }

  wallet(userId: string): Wallet {
    let w = this.wallets.get(userId);
    if (!w) {
      w = { available: 0, held: 0 };
      this.wallets.set(userId, w);
    }
    return w;
  }

  topup(userId: string, amount: number) {
    this.wallet(userId).available += amount;
    this.totalTopup += amount;
    this.add('TOPUP', userId, '-', amount, 'nạp tiền giả lập');
  }

  holdState(requestId: string): HoldState | undefined {
    return this.holds.get(requestId)?.state;
  }

  /** Idempotent: gọi lại cùng requestId không giữ thêm tiền. */
  reserve(userId: string, requestId: string, amount: number): 'CREATED' | 'EXISTS' {
    if (this.holds.has(requestId)) return 'EXISTS';
    const w = this.wallet(userId);
    if (w.available < amount) throw new InsufficientBalanceError('không đủ số dư');
    w.available -= amount;
    w.held += amount;
    this.holds.set(requestId, { userId, amount, state: 'RESERVED' });
    this.add('RESERVE', userId, requestId, amount);
    return 'CREATED';
  }

  /** Chỉ settle được khi đang RESERVED. Gọi lại khi đã SETTLED là không làm gì. */
  settle(requestId: string, servingNodes: string[]): 'SETTLED' | 'NOOP' {
    const h = this.holds.get(requestId);
    if (!h) throw new Error('không có khoản giữ cho yêu cầu này');
    if (h.state === 'SETTLED') return 'NOOP';
    if (h.state === 'RELEASED') throw new Error('khoản giữ đã được hoàn, không thể settle');
    const w = this.wallet(h.userId);
    w.held -= h.amount;
    h.state = 'SETTLED';
    this.add('SETTLE', h.userId, requestId, h.amount);
    const pool = Math.floor((h.amount * 80) / 100);
    const each = servingNodes.length ? Math.floor(pool / servingNodes.length) : 0;
    for (const node of servingNodes) {
      this.nodeRewards.set(node, (this.nodeRewards.get(node) ?? 0) + each);
      this.add('NODE_REWARD', node, requestId, each, 'thưởng node (công thức demo)');
    }
    const fee = h.amount - each * servingNodes.length;
    this.platform += fee;
    this.add('PLATFORM_FEE', 'platform', requestId, fee);
    return 'SETTLED';
  }

  /** Thưởng cho node vì GIỮ mảnh (trả từ quỹ). Trả false nếu quỹ không đủ. */
  payStorage(node: string, amount: number, note: string): boolean {
    const pool = this.wallet(STORAGE_POOL);
    if (pool.available < amount) return false;
    pool.available -= amount;
    this.nodeRewards.set(node, (this.nodeRewards.get(node) ?? 0) + amount);
    this.add('STORAGE_REWARD', node, '-', amount, note);
    return true;
  }

  /** Hoàn khoản giữ. Gọi lại là không làm gì; không hoàn được nếu đã settle. */
  release(requestId: string, reason: string): 'RELEASED' | 'NOOP' {
    const h = this.holds.get(requestId);
    if (!h) return 'NOOP';
    if (h.state === 'RELEASED') return 'NOOP';
    if (h.state === 'SETTLED') throw new Error('đã settle, không thể release');
    const w = this.wallet(h.userId);
    w.held -= h.amount;
    w.available += h.amount;
    h.state = 'RELEASED';
    this.add('RELEASE', h.userId, requestId, h.amount, reason);
    return 'RELEASED';
  }

  rewards() {
    return { nodes: Object.fromEntries(this.nodeRewards), platform: this.platform };
  }

  wallets_() {
    return Object.fromEntries([...this.wallets].map(([u, w]) => [u, { ...w }]));
  }

  /** Tổng tiền phải bảo toàn: nạp vào = số dư + đang giữ + thưởng node + phí nền tảng. */
  checkInvariant(): { ok: boolean; detail: string } {
    let sum = this.platform;
    for (const w of this.wallets.values()) sum += w.available + w.held;
    for (const v of this.nodeRewards.values()) sum += v;
    return { ok: sum === this.totalTopup, detail: `tổng nạp=${this.totalTopup}, tổng hiện có=${sum}` };
  }
}
