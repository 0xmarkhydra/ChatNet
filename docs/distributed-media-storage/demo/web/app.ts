import { generateKey, exportKeyHex, encrypt, decrypt, sha256Hex, bytesToBase64, base64ToBytes } from '../src/e2ee.ts';

// Mọi thứ nhạy cảm (plaintext, khóa) chỉ nằm trong bộ nhớ trang này. Server chỉ nhận ciphertext.
interface ClientMeta { name: string; mime: string; plainSha: string; keyHex: string }
const metas = new Map<string, ClientMeta>(); // mediaId -> thông tin phía client
const keys = new Map<string, CryptoKey>(); // mediaId -> khóa (mô phỏng: đã phân phối cho alice & bob qua E2EE)
const locals = new Map<string, Uint8Array>(); // `${user}:${mediaId}` -> bản plaintext trên máy
let user = 'alice';
let selected: string | null = null;
let state: any = null;
let pending: { requestId: string; quote: any } | null = null;
let result = '';
let toast: { kind: 'err' | 'good'; text: string } | null = null;
let lostKey = false;
// Yêu cầu đã trả phí gần nhất: dùng để gửi lại ĐÚNG requestId khi kiểm tra idempotency
let lastConfirmed: { mediaId: string; requestId: string; quoteId: string; amount: number } | null = null;
let pickedFile: File | null = null; // nhớ file đã chọn vì trang vẽ lại định kỳ

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const short = (id: string) => id.slice(0, 8);
const uuid = () => crypto.randomUUID();

async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  const res = await fetch(path, { method, headers: { 'x-user': user, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? res.statusText), { code: data?.error?.code ?? res.status });
  return data;
}

async function refresh() {
  state = await api('/api/state');
  if (selected && !state.media.some((m: any) => m.id === selected)) selected = null;
  if (!selected && state.media.length) selected = state.media[state.media.length - 1].id;
  render();
}

async function act(fn: () => Promise<void>) {
  toast = null;
  try { await fn(); } catch (e: any) { toast = { kind: 'err', text: `${e.code ?? ''} ${e.message}`.trim() }; }
  await refresh();
}

const sel = () => (state?.media as any[] | undefined)?.find((m) => m.id === selected);
const fmtVnd = (xu: number) => `${(xu / 100).toFixed(2)} COIN (demo)`;

function render() {
  const m = sel();
  const nodesHtml = state.nodes.map((n: any) => {
    const sh = m?.audit.shards[n.index - 1];
    const [bc, bt] = !n.reachable ? ['OFFLINE', 'mất kết nối'] : n.online ? ['OK', 'online'] : ['OFFLINE', 'tạm dừng'];
    return `<div class="node ${n.online ? '' : 'off'}">
      <div class="row"><b>${n.name}</b><span class="badge ${bc}">${bt}</span></div>
      <div class="hint" style="margin:0">domain: ${n.domain}${n.url ? ' · agent ' + esc(n.url.replace('http://', '')) : ''}</div>
      <div class="hint" style="margin:0">giữ ${n.shardCount} mảnh · ${n.heldBytes} B · đã kiếm <b>${n.earned} xu</b></div>
      <div>${m ? `mảnh: <span class="badge ${sh.status}">${sh.status}</span>` : '<span class="hint">chưa có file</span>'}</div>
      <div class="row">
        <button data-a="toggle" data-i="${n.index}" data-on="${n.online}" ${n.reachable ? '' : 'disabled'}>${n.online ? 'Tạm dừng node' : 'Bật node'}</button>
        <button data-a="tamper" data-i="${n.index}" ${m ? '' : 'disabled'} title="Lật 1 byte của mảnh (cùng kích thước)">Làm hỏng mảnh</button>
        <button data-a="lose" data-i="${n.index}" ${m ? '' : 'disabled'} title="Node mất mảnh">Mất mảnh</button>
      </div></div>`;
  }).join('');

  const rows = state.media.map((x: any) => `<tr class="${x.id === selected ? 'sel' : ''}">
    <td><button data-a="select" data-id="${x.id}">${x.id === selected ? '● ' : ''}${short(x.id)}</button></td>
    <td>${esc(metas.get(x.id)?.name ?? '(tên chỉ có ở client)')}<div class="hint" style="margin:0">${x.ciphertextSize} B ciphertext · gửi bởi ${x.owner}</div></td>
    <td><span class="badge ${x.state}">${x.state}</span><div class="hint" style="margin:0">relay: ${x.relayActive ? 'còn hạn' : 'đã hết hạn'}</div></td>
    <td><span class="badge ${x.audit.health}">${x.audit.health}</span> ${x.audit.healthy}/6 mảnh</td>
    <td class="row">
      <button data-a="repair" data-id="${x.id}">Sửa chữa</button>
      <button data-a="archive" data-id="${x.id}" ${x.relayActive ? '' : 'disabled'}>Hết hạn relay</button>
    </td></tr>`).join('');

  const local = m ? locals.get(`${user}:${m.id}`) : undefined;
  const q = pending?.quote;
  const quoteHtml = q?.kind === 'QUOTE'
    ? `<div class="toast good">Báo giá: <b>${fmtVnd(q.amount)}</b> (hết hạn ${new Date(q.expiresAt).toLocaleTimeString()}). Chưa trừ tiền. Hiện có ${q.healthyShards} mảnh khỏe, cần ${q.needed}.
        <div class="row" style="margin-top:6px">
          <button class="primary" data-a="confirm">Xác nhận &amp; trả phí</button>
          <button data-a="cancel">Hủy</button>
        </div></div>`
    : q ? `<div class="toast err">${esc(q.message ?? q.kind)}</div>` : '';

  const w = state.wallets;
  $('#app').innerHTML = `
  ${toast ? `<div class="toast ${toast.kind}">${esc(toast.text)}</div>` : ''}
  <section class="card"><h2>1. Gửi file (mã hóa ngay trong trình duyệt)</h2>
    <p class="hint">Khóa AES-256-GCM sinh tại đây. Server/node chỉ nhận ciphertext, không nhận khóa, không nhận tên file. File sẽ được chia ${state.params.k}-of-${state.params.n} và đặt lên 6 node.</p>
    <div class="row"><input id="file" type="file" /><button class="primary" data-a="upload" ${user === 'alice' ? '' : 'disabled'}>Mã hóa &amp; gửi cho alice + bob</button>${user === 'alice' ? '' : '<span class="hint">chỉ alice gửi trong demo</span>'}</div>
  </section>
  <section class="card"><h2>2. Mạng lưu trữ: 6 node tình nguyện (mỗi node là một chương trình agent riêng, nói chuyện qua mạng)</h2>
    <p class="hint">Mỗi node giống ứng dụng desktop của một người cho mượn ổ cứng: chỉ giữ mảnh đã mã hóa. Thử: tạm dừng 2 node → vẫn khôi phục; 3 node → không khôi phục, không thu phí. Bạn cũng có thể tắt hẳn một cửa sổ agent (node báo "mất kết nối"). "Làm hỏng mảnh" lật 1 byte → hash phát hiện. Đang chọn media: ${m ? short(m.id) : '(chưa có)'}.</p>
    <div class="row" style="margin-bottom:10px"><button data-a="day">Tua nhanh 1 ngày (trả thưởng giữ mảnh)</button>
      <span class="hint" style="margin:0">Ngày thứ <b>${state.day}</b> · quỹ thưởng lưu trữ còn <b>${state.pool} xu</b> (ngân sách giả định; ai nạp quỹ là câu hỏi mở). Chỉ mảnh qua kiểm tra hash mới được thưởng.</span></div>
    <div class="grid">${nodesHtml}</div>
  </section>
  <section class="card"><h2>3. File trong mạng (${esc(user)} thấy ${state.media.length})</h2>
    <p class="hint">Vòng đời: RELAY_ACTIVE → DISTRIBUTING → DURABLE_VERIFIED → ARCHIVED. "Hết hạn relay" chỉ thành công khi audit đủ 6 mảnh, ≥3 failure domain và diễn tập khôi phục đạt; nếu không → AT_RISK và giữ relay.</p>
    ${state.media.length ? `<table><thead><tr><th>ID</th><th>File</th><th>Trạng thái</th><th>Sức khỏe</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">Chưa có file nào mà người dùng này truy cập được. (dave luôn không thấy file của alice/bob.)</p>'}
  </section>
  <section class="card"><h2>4. Mở file / "Truy cập lại"</h2>
    ${m ? `<p class="hint">Bản trên máy của ${esc(user)}: <b>${local ? 'có' : 'không'}</b> · Relay: <b>${m.relayActive ? 'còn hạn' : 'đã hết hạn'}</b>. Mở bản trên máy và tải relay còn hạn là miễn phí; chỉ khi không còn cả hai mới truy cập lại từ mạng và tính phí (công thức giá chỉ là minh họa: ${fmtVnd(m.price)}).</p>
    <div class="row">
      <button data-a="open-local" ${local ? '' : 'disabled'}>Mở bản trên máy (0 phí)</button>
      <button data-a="drop-local" ${local ? '' : 'disabled'}>Xóa bản trên máy</button>
      <button data-a="relay" ${m.relayActive ? '' : 'disabled'}>Tải từ relay (0 phí)</button>
      <button class="primary" data-a="quote" ${m.relayActive || local ? 'disabled' : ''} title="${local ? 'Đã có bản trên máy: mở bằng nút 0 phí' : 'Mỗi lần bấm là một lần trả phí'}">Truy cập lại (có phí)…</button>
      <label><input type="checkbox" id="lostkey" ${lostKey ? 'checked' : ''}/> giả lập mất khóa</label>
      ${lastConfirmed && m && lastConfirmed.mediaId === m.id ? '<button data-a="resend" title="Gửi lại đúng requestId đã trả phí">Gửi lại cùng request đã trả</button>' : ''}
    </div>${quoteHtml}` : '<p class="hint">Chọn một file ở mục 3.</p>'}
    <div id="result">${result}</div>
  </section>
  <section class="card"><h2>5. Ví giả lập &amp; sổ giao dịch</h2>
    <table><thead><tr><th>Người dùng</th><th>Khả dụng</th><th>Đang giữ</th></tr></thead><tbody>
      ${Object.entries(w).filter(([u]) => u !== 'storage-pool').map(([u, x]: any) => `<tr><td>${u}</td><td>${x.available} xu</td><td>${x.held} xu</td></tr>`).join('')}
    </tbody></table>
    <p class="hint">Thưởng node: ${esc(JSON.stringify(state.rewards.nodes))} · phí nền tảng: ${state.rewards.platform} xu · bảo toàn tiền: <span class="badge ${state.invariant.ok ? 'OK' : 'FAILED'}">${state.invariant.ok ? 'ĐÚNG' : 'SAI'}</span> (${esc(state.invariant.detail)})</p>
    <table><thead><tr><th>#</th><th>Loại</th><th>Ai</th><th>Request</th><th>Số xu</th><th>Ghi chú</th></tr></thead><tbody>
      ${state.ledger.slice().reverse().map((e: any) => `<tr><td>${e.id}</td><td>${e.type}</td><td>${esc(e.userId)}</td><td class="mono">${esc(e.requestId.slice(0, 8))}</td><td>${e.amount}</td><td>${esc(e.note ?? '')}</td></tr>`).join('')}
    </tbody></table>
  </section>
  <section class="card"><h2>6. Nhật ký hệ thống</h2><div id="log">${state.log.map((l: any) => `<div>${esc(l.at.slice(11, 19))}  ${esc(l.msg)}</div>`).join('')}</div></section>`;
  const log = $('#log'); log.scrollTop = log.scrollHeight;
  const fi = document.querySelector('#file') as HTMLInputElement | null;
  if (fi && pickedFile) { const dt = new DataTransfer(); dt.items.add(pickedFile); fi.files = dt.files; }
  const lk = document.querySelector('#lostkey') as HTMLInputElement | null;
  if (lk) lk.onchange = () => { lostKey = lk.checked; };
}

async function decryptAndShow(mediaId: string, cipherB64: string, label: string) {
  const meta = metas.get(mediaId)!;
  const key = lostKey ? await generateKey() : keys.get(mediaId)!;
  const plain = await decrypt(key, base64ToBytes(cipherB64)); // ném lỗi nếu sai khóa/dữ liệu hỏng
  const sha = await sha256Hex(plain);
  locals.set(`${user}:${mediaId}`, plain);
  showPlain(meta, plain, sha, label);
}

function showPlain(meta: ClientMeta, plain: Uint8Array, sha: string, label: string) {
  const url = URL.createObjectURL(new Blob([plain as BlobPart], { type: meta.mime }));
  const same = sha === meta.plainSha;
  let preview = '';
  if (meta.mime.startsWith('image/')) preview = `<img class="preview" src="${url}" alt="xem trước" />`;
  else if (meta.mime.startsWith('text/')) preview = `<pre class="mono">${esc(new TextDecoder().decode(plain.subarray(0, 600)))}</pre>`;
  result = `<div class="toast ${same ? 'good' : 'err'}"><b>${esc(label)}</b>: ${plain.length} byte · SHA-256 ${same ? 'TRÙNG file gốc ✔' : 'LỆCH ✘'} <span class="mono">${sha.slice(0, 16)}…</span>
    <div>${preview}</div><a href="${url}" download="${esc(meta.name)}">Tải file về</a></div>`;
}

async function onClick(e: Event) {
  const b = (e.target as HTMLElement).closest('button[data-a]') as HTMLElement | null;
  if (!b) return;
  const a = b.dataset.a!;
  const i = b.dataset.i;
  if (a === 'select') { selected = b.dataset.id!; pending = null; result = ''; return void render(); }
  if (a === 'toggle') return act(() => api(`/api/nodes/${i}`, 'POST', { action: b.dataset.on === 'true' ? 'offline' : 'online' }));
  if (a === 'tamper' || a === 'lose') return act(() => api(`/api/nodes/${i}`, 'POST', { action: a, mediaId: selected }));
  if (a === 'day') return act(async () => {
    const r = await api('/api/advance-day', 'POST');
    const nodes = Object.entries(r.perNode).map(([n, v]) => `${n}: +${v}`).join(', ') || 'không node nào';
    const skip = r.skipped.length ? `. Không được thưởng: ${r.skipped.map((x: any) => `${x.node} (${x.status})`).join(', ')}` : '';
    toast = { kind: 'good', text: `Ngày ${r.day}: trả ${r.paid} xu từ quỹ (${nodes})${skip}${r.poolEmpty ? '. QUỸ HẾT' : ''}` };
  });
  if (a === 'repair') return act(async () => { const r = await api(`/api/media/${b.dataset.id}/repair`, 'POST'); toast = { kind: 'good', text: `Đã dựng lại mảnh node [${r.repaired.join(', ') || '-'}]${r.stillBad.length ? `; node offline chưa sửa được [${r.stillBad.join(', ')}]` : ''}` }; });
  if (a === 'archive') return act(async () => { const r = await api(`/api/media/${b.dataset.id}/archive`, 'POST'); toast = r.archived ? { kind: 'good', text: 'Relay đã hết hạn (mô phỏng): đủ điều kiện an toàn.' } : { kind: 'err', text: `KHÔNG hết hạn relay: ${r.reasons.join('; ')}` }; });
  if (a === 'drop-local') { locals.delete(`${user}:${selected}`); result = ''; return void refresh(); }
  if (a === 'open-local') {
    const plain = locals.get(`${user}:${selected}`); const meta = metas.get(selected!);
    if (plain && meta) { showPlain(meta, plain, await sha256Hex(plain), 'Mở bản trên máy (không gọi mạng, không tính phí)'); render(); }
    return;
  }
  if (a === 'relay') return act(async () => { const r = await api(`/api/media/${selected}/relay`); await decryptAndShow(selected!, r.ciphertextB64, 'Tải từ relay còn hạn (miễn phí)'); });
  if (a === 'quote') return act(async () => { if (locals.has(`${user}:${selected}`)) throw new Error('Đã có bản trên máy, mở bằng "Mở bản trên máy" (0 phí)'); result = ''; const q = await api(`/api/media/${selected}/reaccess-quote`); pending = { requestId: uuid(), quote: q }; });
  if (a === 'cancel') return act(async () => { pending = null; });
  if (a === 'confirm') return act(async () => {
    if (!pending || pending.quote.kind !== 'QUOTE') return;
    lastConfirmed = { mediaId: selected!, requestId: pending.requestId, quoteId: pending.quote.quoteId, amount: pending.quote.amount };
    const v = await api(`/api/media/${selected}/reaccess`, 'POST', { requestId: pending.requestId, quoteId: pending.quote.quoteId, acceptedAmount: pending.quote.amount });
    if (v.replay) toast = { kind: 'good', text: 'Cùng requestId: server trả kết quả cũ, KHÔNG tính tiền lần nữa.' };
    if (v.state === 'RECONSTRUCTED' && v.ciphertextB64) {
      try {
        await decryptAndShow(selected!, v.ciphertextB64, 'Truy cập lại thành công');
        const end = await api(`/api/reaccess/${pending.requestId}/client-receipt`, 'POST', { ok: true });
        toast = { kind: 'good', text: `Kết thúc: ${end.state}. Đã tính phí đúng một lần.` };
      } catch {
        const end = await api(`/api/reaccess/${pending.requestId}/client-receipt`, 'POST', { ok: false });
        result = `<div class="toast err">Client không giải mã được (mất/sai khóa) → ${end.state}: đã hoàn tiền, không thu phí.</div>`;
      }
      pending = null;
    } else if (v.state === 'RELEASED') {
      result = `<div class="toast err">Thất bại: ${esc(v.failure)} → đã hoàn tiền, không thu phí.</div>`; pending = null;
    }
  });
  if (a === 'resend') return act(async () => {
    if (!lastConfirmed) return;
    const v = await api(`/api/media/${lastConfirmed.mediaId}/reaccess`, 'POST', { requestId: lastConfirmed.requestId, quoteId: lastConfirmed.quoteId, acceptedAmount: lastConfirmed.amount });
    toast = { kind: 'good', text: `Gửi lại cùng requestId: server trả kết quả cũ (trạng thái ${v.state}), KHÔNG tính tiền lần nữa.` };
  });
  if (a === 'upload') return act(async () => {
    const f = pickedFile ?? (document.querySelector('#file') as HTMLInputElement).files?.[0];
    if (!f) throw new Error('Hãy chọn một file (ảnh nhỏ < 20 MB là đẹp nhất)');
    const plain = new Uint8Array(await f.arrayBuffer());
    const key = await generateKey();
    const ct = await encrypt(key, plain);
    const r = await api('/api/media', 'POST', { ciphertextB64: bytesToBase64(ct), members: ['bob'] });
    const meta = { name: f.name, mime: f.type || 'application/octet-stream', plainSha: await sha256Hex(plain), keyHex: await exportKeyHex(key) };
    metas.set(r.id, meta); keys.set(r.id, key); locals.set(`alice:${r.id}`, plain);
    selected = r.id; pending = null; result = ''; pickedFile = null;
    toast = { kind: 'good', text: `Đã gửi. Server chỉ nhận ${ct.length} byte ciphertext; trạng thái: ${r.state}. Khóa (chỉ ở client): ${meta.keyHex.slice(0, 12)}…` };
  });
}

$('#app').addEventListener('click', (e) => void onClick(e));
$('#app').addEventListener('change', (e) => { const t = e.target as HTMLInputElement; if (t.id === 'file') pickedFile = t.files?.[0] ?? null; });
($('#user') as HTMLSelectElement).onchange = (e) => { user = (e.target as HTMLSelectElement).value; pending = null; result = ''; selected = null; void act(async () => {}); };
$('#reset').onclick = () => void act(async () => { await api('/api/reset', 'POST'); metas.clear(); keys.clear(); locals.clear(); lastConfirmed = null; selected = null; pending = null; result = ''; });
void act(async () => {});
setInterval(() => { if (!document.hidden && !pending) void refresh().catch(() => {}); }, 5000);
