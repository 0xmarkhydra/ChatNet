// Reed-Solomon (MDS) trên GF(256), dạng systematic: n mảnh = k mảnh dữ liệu + (n-k) mảnh parity.
// Bất kỳ k mảnh nào trong n cũng đủ để dựng lại dữ liệu. Ma trận parity là ma trận Cauchy.
// Chỉ là POC để học/diễn giải; chưa tối ưu tốc độ, chưa được kiểm toán.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // đa thức x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

export function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

export function gfInv(a: number): number {
  if (a === 0) throw new Error('GF(256): không có nghịch đảo của 0');
  return EXP[255 - LOG[a]];
}

function mulTable(c: number): Uint8Array {
  const t = new Uint8Array(256);
  for (let v = 0; v < 256; v++) t[v] = gfMul(c, v);
  return t;
}

/** Ma trận mã hóa n×k: k hàng đầu là ma trận đơn vị, các hàng sau là Cauchy. */
export function encodeMatrix(k: number, n: number): number[][] {
  if (!(k >= 1 && n > k && n <= 255)) throw new Error('tham số (k, n) không hợp lệ');
  const m: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = new Array<number>(k).fill(0);
    if (r < k) row[r] = 1;
    else for (let j = 0; j < k; j++) row[j] = gfInv(r ^ j); // r >= k > j nên r ^ j != 0
    m.push(row);
  }
  return m;
}

export interface EncodeResult {
  shards: Uint8Array[];
  shardSize: number;
}

export function encode(data: Uint8Array, k: number, n: number): EncodeResult {
  const shardSize = Math.max(1, Math.ceil(data.length / k));
  const shards = Array.from({ length: n }, () => new Uint8Array(shardSize));
  for (let j = 0; j < k; j++) {
    const start = Math.min(data.length, j * shardSize);
    const end = Math.min(data.length, (j + 1) * shardSize);
    shards[j].set(data.subarray(start, end));
  }
  const m = encodeMatrix(k, n);
  for (let r = k; r < n; r++) {
    const out = shards[r];
    for (let j = 0; j < k; j++) {
      const t = mulTable(m[r][j]);
      const src = shards[j];
      for (let p = 0; p < shardSize; p++) out[p] ^= t[src[p]];
    }
  }
  return { shards, shardSize };
}

function invertMatrix(a: number[][]): number[][] {
  const k = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < k; col++) {
    let pivot = col;
    while (pivot < k && m[pivot][col] === 0) pivot++;
    if (pivot === k) throw new Error('ma trận không khả nghịch');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const inv = gfInv(m[col][col]);
    for (let j = 0; j < 2 * k; j++) m[col][j] = gfMul(m[col][j], inv);
    for (let r = 0; r < k; r++) {
      if (r === col || m[r][col] === 0) continue;
      const f = m[r][col];
      for (let j = 0; j < 2 * k; j++) m[r][j] ^= gfMul(f, m[col][j]);
    }
  }
  return m.map((row) => row.slice(k));
}

/** available: chỉ số mảnh -> nội dung. Cần ít nhất k mảnh (cùng kích thước). */
export function decode(
  available: Map<number, Uint8Array>,
  k: number,
  n: number,
  originalLength: number,
): Uint8Array {
  const idx = [...available.keys()].sort((a, b) => a - b).slice(0, k);
  if (idx.length < k) throw new Error(`không đủ mảnh: có ${available.size}, cần ${k}`);
  const shardSize = available.get(idx[0])!.length;
  for (const i of idx) {
    if (i < 0 || i >= n) throw new Error(`chỉ số mảnh ${i} ngoài khoảng`);
    if (available.get(i)!.length !== shardSize) throw new Error('các mảnh khác kích thước');
  }
  const m = encodeMatrix(k, n);
  const inv = invertMatrix(idx.map((i) => m[i].slice()));
  const out = new Uint8Array(k * shardSize);
  for (let j = 0; j < k; j++) {
    const dst = out.subarray(j * shardSize, (j + 1) * shardSize);
    for (let t = 0; t < k; t++) {
      const coef = inv[j][t];
      if (coef === 0) continue;
      const tbl = mulTable(coef);
      const src = available.get(idx[t])!;
      for (let p = 0; p < shardSize; p++) dst[p] ^= tbl[src[p]];
    }
  }
  return out.slice(0, originalLength);
}
