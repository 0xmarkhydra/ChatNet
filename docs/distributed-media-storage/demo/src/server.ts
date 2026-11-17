import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { DmsService, DmsError, USERS, N } from './service.ts';
import { RemoteNetwork } from './network.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 5600);
const DATA = process.env.DMS_DATA_DIR ?? join(ROOT, 'data');

// --- 6 node = 6 chương trình agent riêng (mặc định server tự mở; DMS_NODE_URLS để dùng agent ở nơi khác) ---
const BASE_PORT = Number(process.env.DMS_AGENT_BASE_PORT ?? 6201);
const external = process.env.DMS_NODE_URLS?.split(',').map((x) => x.trim()).filter(Boolean);
const urls = external?.length === N ? external : Array.from({ length: N }, (_, i) => `http://127.0.0.1:${BASE_PORT + i}`);
const children: ChildProcess[] = [];
if (!external?.length && process.env.DMS_SPAWN_AGENTS !== '0') {
  for (let i = 0; i < N; i++) {
    const name = `node-${i + 1}`;
    const c = spawn(process.execPath, ['--no-warnings', '--experimental-strip-types', join(ROOT, 'src', 'agent.ts'), '--name', name, '--port', String(BASE_PORT + i), '--dir', join(DATA, 'agents', name)], { stdio: 'inherit' });
    children.push(c);
  }
  const killAll = () => children.forEach((c) => c.kill());
  process.on('exit', killAll);
  process.on('SIGINT', () => { killAll(); process.exit(0); });
  process.on('SIGTERM', () => { killAll(); process.exit(0); });
}
const network = new RemoteNetwork(urls);
for (let t = 0; t < 40; t++) {
  if ((await network.describe()).every((n) => n.reachable)) break;
  await new Promise((r) => setTimeout(r, 250));
}

// Mỗi lần "Reset demo" tạo thư mục dữ liệu mới và cất mảnh cũ vào archive-* (không xóa gì).
let runNo = 0;
let svc = await newService();
async function newService() {
  runNo += 1;
  await network.resetAll();
  const dir = join(DATA, `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${runNo}`);
  console.log(`[demo] dữ liệu phiên này: ${dir}`);
  return new DmsService(dir, network);
}

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  const data = type === 'application/json' ? JSON.stringify(body) : (body as string | Buffer);
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(data);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 40 * 1024 * 1024) throw new DmsError(413, 'PAYLOAD_TOO_LARGE', 'Demo giới hạn ~25 MB mỗi file');
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DmsError(400, 'BAD_JSON', 'JSON không hợp lệ');
  }
}

function userOf(req: IncomingMessage): string {
  const u = String(req.headers['x-user'] ?? '');
  if (!(USERS as readonly string[]).includes(u)) throw new DmsError(401, 'UNAUTHENTICATED', 'Thiếu/sai header x-user (alice|bob|dave)');
  return u;
}

function serveStatic(pathname: string, res: ServerResponse) {
  const rel = pathname === '/' ? '/web/index.html' : pathname;
  if (!(rel.startsWith('/web/') || rel.startsWith('/src/e2ee.ts'))) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
  const file = resolve(join(ROOT, normalize(rel)));
  if (!file.startsWith(ROOT + sep) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
  const ext = extname(file);
  if (ext === '.ts') {
    // Trình duyệt không chạy TS: bỏ kiểu rồi trả JS (cùng cú pháp "chỉ xóa kiểu" như phía Node).
    const js = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' });
    return send(res, 200, js, 'text/javascript; charset=utf-8');
  }
  send(res, 200, readFileSync(file), MIME[ext] ?? 'application/octet-stream');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const p = url.pathname;
  try {
    if (!p.startsWith('/api/')) return serveStatic(p, res);
    const m = req.method ?? 'GET';
    let g: RegExpMatchArray | null;

    if (m === 'POST' && p === '/api/reset') {
      svc = await newService();
      return send(res, 200, { ok: true });
    }
    if (m === 'GET' && p === '/api/state') return send(res, 200, await svc.snapshot(userOf(req)));

    if (m === 'POST' && p === '/api/media') {
      const user = userOf(req);
      const b = await readJson(req);
      if (typeof b.ciphertextB64 !== 'string') throw new DmsError(400, 'BAD_REQUEST', 'thiếu ciphertextB64');
      const media = await svc.upload(user, Array.isArray(b.members) ? b.members : [], new Uint8Array(Buffer.from(b.ciphertextB64, 'base64')));
      return send(res, 201, { id: media.id, state: media.state, manifest: media.manifest });
    }
    if ((g = p.match(/^\/api\/media\/([^/]+)\/relay$/)) && m === 'GET') {
      const data = svc.downloadRelay(g[1], userOf(req));
      return send(res, 200, { ciphertextB64: Buffer.from(data).toString('base64') });
    }
    if ((g = p.match(/^\/api\/media\/([^/]+)\/audit$/)) && m === 'GET') return send(res, 200, await svc.audit(g[1], userOf(req)));
    if ((g = p.match(/^\/api\/media\/([^/]+)\/repair$/)) && m === 'POST') return send(res, 200, await svc.repair(g[1], userOf(req)));
    if ((g = p.match(/^\/api\/media\/([^/]+)\/archive$/)) && m === 'POST') return send(res, 200, await svc.evaluateArchive(g[1], userOf(req)));
    if ((g = p.match(/^\/api\/media\/([^/]+)\/reaccess-quote$/)) && m === 'GET') return send(res, 200, await svc.quote(g[1], userOf(req)));
    if ((g = p.match(/^\/api\/media\/([^/]+)\/reaccess$/)) && m === 'POST') {
      const v = await svc.reaccess(g[1], userOf(req), await readJson(req));
      return send(res, 200, v);
    }
    if ((g = p.match(/^\/api\/reaccess\/([^/]+)\/client-receipt$/)) && m === 'POST') {
      const b = await readJson(req);
      return send(res, 200, svc.clientReceipt(g[1], userOf(req), b.ok === true));
    }
    if ((g = p.match(/^\/api\/reaccess\/([^/]+)\/cancel$/)) && m === 'POST') return send(res, 200, svc.cancel(g[1], userOf(req)));
    if ((g = p.match(/^\/api\/nodes\/(\d+)$/)) && m === 'POST') {
      userOf(req);
      const b = await readJson(req);
      await svc.nodeAction(Number(g[1]) - 1, String(b.action), b.mediaId);
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && p === '/api/advance-day') {
      userOf(req);
      return send(res, 200, await svc.advanceDay());
    }
    throw new DmsError(404, 'NOT_FOUND', 'API không tồn tại');
  } catch (e) {
    if (e instanceof DmsError) return send(res, e.status, { error: { code: e.code, message: e.message } });
    console.error(e);
    send(res, 500, { error: { code: 'INTERNAL', message: (e as Error).message } });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`[demo] mở http://localhost:${PORT}  (chỉ lắng nghe 127.0.0.1)`));
