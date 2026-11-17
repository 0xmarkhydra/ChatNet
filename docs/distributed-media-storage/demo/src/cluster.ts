import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Mỗi cặp node dùng chung một "failure domain" (giả lập cùng ISP/khu vực). */
export const NODE_DOMAINS = ['HN-ISP1', 'HN-ISP1', 'HCM-ISP2', 'HCM-ISP2', 'DN-ISP3', 'DN-ISP3'];

export class NodeOfflineError extends Error {}

/** 6 "máy lưu trữ" giả lập = 6 thư mục node-1 .. node-6. Chỉ chứa mảnh đã mã hóa. */
export class NodeCluster {
  readonly count: number;
  private online: boolean[];
  private root: string;

  constructor(root: string, count = 6) {
    this.root = root;
    this.count = count;
    this.online = new Array<boolean>(count).fill(true);
    for (let i = 0; i < count; i++) mkdirSync(this.dir(i), { recursive: true });
  }

  private dir(i: number) {
    return join(this.root, `node-${i + 1}`);
  }

  shardPath(i: number, mediaId: string) {
    return join(this.dir(i), `${mediaId}.shard`);
  }

  usage(i: number): { shardCount: number; bytes: number } {
    let shardCount = 0, bytes = 0;
    for (const f of readdirSync(this.dir(i))) {
      if (!f.endsWith('.shard')) continue;
      shardCount += 1;
      bytes += statSync(join(this.dir(i), f)).size;
    }
    return { shardCount, bytes };
  }

  isOnline(i: number) {
    return this.online[i];
  }

  setOnline(i: number, v: boolean) {
    this.online[i] = v;
  }

  put(i: number, mediaId: string, bytes: Uint8Array) {
    if (!this.online[i]) throw new NodeOfflineError(`node-${i + 1} đang offline`);
    writeFileSync(this.shardPath(i, mediaId), bytes);
  }

  /** null = không có mảnh (mất). Ném NodeOfflineError nếu node offline. */
  get(i: number, mediaId: string): Uint8Array | null {
    if (!this.online[i]) throw new NodeOfflineError(`node-${i + 1} đang offline`);
    const p = this.shardPath(i, mediaId);
    return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
  }

  /** Giả lập mảnh bị hỏng: lật 1 byte (cùng kích thước). */
  tamper(i: number, mediaId: string): boolean {
    const p = this.shardPath(i, mediaId);
    if (!existsSync(p)) return false;
    const b = readFileSync(p);
    b[0] ^= 0xff;
    writeFileSync(p, b);
    return true;
  }

  /** Giả lập node mất mảnh: đổi tên .lost (không xóa dữ liệu). */
  lose(i: number, mediaId: string): boolean {
    const p = this.shardPath(i, mediaId);
    if (!existsSync(p)) return false;
    renameSync(p, `${p}.lost`);
    return true;
  }
}
