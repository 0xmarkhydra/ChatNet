// Chương trình "node" (mô phỏng ứng dụng desktop của người cho mượn ổ cứng).
// Chạy riêng:  node --no-warnings --experimental-strip-types src/agent.ts --name node-1 --port 6201 --dir ./agent-data/node-1
// Chỉ lưu/trả MẢNH ĐÃ MÃ HÓA; không có khóa, không biết đây là file gì.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface AgentOptions {
  name: string;
  dir: string;
  port: number; // 0 = cổng ngẫu nhiên (dùng cho test)
  host?: string;
}

const ID = /^[0-9a-f-]{36}$/;
const MAX = 64 * 1024 * 1024;

export async function startAgent(opts: AgentOptions): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const dir = resolve(opts.dir);
  mkdirSync(dir, { recursive: true });
  let paused = false;
  const path = (id: string) => join(dir, `${id}.shard`);

  const stats = () => {
    let shards = 0, bytes = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.shard')) continue;
      shards += 1;
      bytes += statSync(join(dir, f)).size;
    }
    return { shards, bytes };
  };

  const server = createServer(async (req, res) => {
    const reply = (status: number, body?: unknown, raw = false) => {
      res.writeHead(status, { 'content-type': raw ? 'application/octet-stream' : 'application/json' });
      res.end(body === undefined ? undefined : raw ? (body as Uint8Array) : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const m = req.method ?? 'GET';
      const parts = url.pathname.split('/').filter(Boolean);

      if (m === 'GET' && url.pathname === '/health') return reply(200, { name: opts.name, paused, ...stats() });

      // --- thao tác giả lập sự cố (luôn dùng được, kể cả khi tạm dừng) ---
      if (m === 'POST' && parts[0] === 'admin') {
        const id = parts[2];
        if (parts[1] === 'pause') { paused = true; return reply(200, { ok: true }); }
        if (parts[1] === 'resume') { paused = false; return reply(200, { ok: true }); }
        if (parts[1] === 'reset') {
          // chuyển mảnh cũ sang thư mục archive-*, KHÔNG xóa
          const dest = join(dir, `archive-${new Date().toISOString().replace(/[:.]/g, '-')}`);
          let moved = 0;
          for (const f of readdirSync(dir)) {
            if (!f.endsWith('.shard') && !f.endsWith('.shard.lost')) continue;
            if (!moved) mkdirSync(dest, { recursive: true });
            renameSync(join(dir, f), join(dest, f));
            moved += 1;
          }
          paused = false;
          return reply(200, { ok: true, moved });
        }
        if ((parts[1] === 'tamper' || parts[1] === 'lose') && id && ID.test(id)) {
          const p = path(id);
          if (!existsSync(p)) return reply(404, { ok: false });
          if (parts[1] === 'tamper') {
            const b = readFileSync(p);
            b[0] ^= 0xff; // lật 1 byte, cùng kích thước
            writeFileSync(p, b);
          } else renameSync(p, `${p}.lost`);
          return reply(200, { ok: true });
        }
        return reply(400, { error: 'bad admin request' });
      }

      if (parts[0] === 'shard' && parts[1] && ID.test(parts[1])) {
        if (paused) return reply(503, { error: 'paused' });
        const p = path(parts[1]);
        if (m === 'PUT') {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const c of req) {
            size += (c as Buffer).length;
            if (size > MAX) return reply(413, { error: 'too large' });
            chunks.push(c as Buffer);
          }
          writeFileSync(p, Buffer.concat(chunks));
          return reply(204);
        }
        if (m === 'GET') {
          if (!existsSync(p)) return reply(404, { error: 'not found' });
          return reply(200, new Uint8Array(readFileSync(p)), true);
        }
      }
      reply(404, { error: 'not found' });
    } catch (e) {
      reply(500, { error: (e as Error).message });
    }
  });

  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port, opts.host ?? '127.0.0.1', () => ok());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : opts.port;
  return { server, port, close: () => new Promise<void>((ok) => { server.close(() => ok()); server.closeAllConnections(); }) };
}

// Chạy trực tiếp: đọc tham số dòng lệnh
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/src/agent.ts')) {
  const arg = (k: string, d: string) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
  };
  const name = arg('name', 'node-1');
  const port = Number(arg('port', '6201'));
  startAgent({ name, port, dir: arg('dir', join('agent-data', name)), host: arg('host', '127.0.0.1') })
    .then((a) => console.log(`[${name}] agent chạy ở cổng ${a.port} (chỉ giữ mảnh đã mã hóa)`))
    .catch((e) => { console.error(`[${name}] không khởi động được: ${(e as Error).message}`); process.exit(1); });
}
