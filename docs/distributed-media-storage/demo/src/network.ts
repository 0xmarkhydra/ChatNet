import { NodeCluster, NodeOfflineError, NODE_DOMAINS } from './cluster.ts';

export { NodeOfflineError, NODE_DOMAINS };

export interface NodeInfo {
  index: number; // 1..n
  name: string;
  domain: string;
  online: boolean; // false nếu tạm dừng hoặc mất kết nối
  reachable: boolean; // false nếu không gọi được tới chương trình node
  shardCount: number;
  heldBytes: number;
  url?: string;
}

/** Cách server nói chuyện với các node: thư mục trong máy (test) hoặc agent HTTP riêng (demo thật). */
export interface ShardNetwork {
  readonly count: number;
  describe(): Promise<NodeInfo[]>;
  isOnline(i: number): Promise<boolean>;
  put(i: number, mediaId: string, bytes: Uint8Array): Promise<void>;
  /** null = node không có mảnh. Ném NodeOfflineError nếu node offline/không kết nối được. */
  get(i: number, mediaId: string): Promise<Uint8Array | null>;
  admin(i: number, action: 'offline' | 'online' | 'tamper' | 'lose', mediaId?: string): Promise<boolean>;
  /** Đưa mảnh cũ sang thư mục lưu trữ (không xóa) và bật lại mọi node. */
  resetAll?(): Promise<void>;
}

export class LocalNetwork implements ShardNetwork {
  readonly count: number;
  private c: NodeCluster;
  constructor(root: string, count = 6) {
    this.count = count;
    this.c = new NodeCluster(root, count);
  }
  async describe(): Promise<NodeInfo[]> {
    return Array.from({ length: this.count }, (_, i) => {
      const u = this.c.usage(i);
      return { index: i + 1, name: `node-${i + 1}`, domain: NODE_DOMAINS[i], online: this.c.isOnline(i), reachable: true, shardCount: u.shardCount, heldBytes: u.bytes };
    });
  }
  async isOnline(i: number) { return this.c.isOnline(i); }
  async put(i: number, id: string, b: Uint8Array) { this.c.put(i, id, b); }
  async get(i: number, id: string) { return this.c.get(i, id); }
  async admin(i: number, action: 'offline' | 'online' | 'tamper' | 'lose', id?: string) {
    if (action === 'offline') { this.c.setOnline(i, false); return true; }
    if (action === 'online') { this.c.setOnline(i, true); return true; }
    if (!id) return false;
    return action === 'tamper' ? this.c.tamper(i, id) : this.c.lose(i, id);
  }
}

/** Mỗi node là một chương trình agent riêng, nói chuyện qua HTTP. */
export class RemoteNetwork implements ShardNetwork {
  readonly count: number;
  readonly urls: string[];
  constructor(urls: string[]) {
    this.urls = urls;
    this.count = urls.length;
  }

  private async call(i: number, path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(this.urls[i] + path, { ...init, signal: AbortSignal.timeout(4000) });
    } catch {
      throw new NodeOfflineError(`node-${i + 1} không kết nối được (${this.urls[i]})`);
    }
  }

  async describe(): Promise<NodeInfo[]> {
    return Promise.all(this.urls.map(async (url, i): Promise<NodeInfo> => {
      const base = { index: i + 1, name: `node-${i + 1}`, domain: NODE_DOMAINS[i], url };
      try {
        const r = await this.call(i, '/health');
        const h = (await r.json()) as { paused: boolean; shards: number; bytes: number };
        return { ...base, online: !h.paused, reachable: true, shardCount: h.shards, heldBytes: h.bytes };
      } catch {
        return { ...base, online: false, reachable: false, shardCount: 0, heldBytes: 0 };
      }
    }));
  }

  async isOnline(i: number) {
    try {
      const r = await this.call(i, '/health');
      return !((await r.json()) as { paused: boolean }).paused;
    } catch {
      return false;
    }
  }

  async put(i: number, id: string, bytes: Uint8Array) {
    const r = await this.call(i, `/shard/${id}`, { method: 'PUT', body: bytes as unknown as BodyInit });
    if (r.status === 503) throw new NodeOfflineError(`node-${i + 1} đang tạm dừng`);
    if (!r.ok) throw new Error(`node-${i + 1} từ chối lưu mảnh (${r.status})`);
  }

  async get(i: number, id: string) {
    const r = await this.call(i, `/shard/${id}`);
    if (r.status === 503) throw new NodeOfflineError(`node-${i + 1} đang tạm dừng`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`node-${i + 1} lỗi ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }

  async admin(i: number, action: 'offline' | 'online' | 'tamper' | 'lose', id?: string) {
    const path = action === 'offline' ? '/admin/pause' : action === 'online' ? '/admin/resume' : `/admin/${action}/${id}`;
    if ((action === 'tamper' || action === 'lose') && !id) return false;
    const r = await this.call(i, path, { method: 'POST' });
    return r.ok;
  }

  async resetAll() {
    await Promise.all(this.urls.map((_, i) => this.call(i, '/admin/reset', { method: 'POST' }).catch(() => undefined)));
  }
}
