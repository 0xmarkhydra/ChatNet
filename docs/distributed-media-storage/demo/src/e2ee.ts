// Mã hóa đầu cuối (AES-256-GCM) bằng WebCrypto. Dùng chung cho trình duyệt và Node 22.
// Khóa chỉ nằm ở client; server và node chỉ nhận ciphertext.

const subtle = globalThis.crypto.subtle;

export async function generateKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportKeyHex(key: CryptoKey): Promise<string> {
  return toHex(new Uint8Array(await subtle.exportKey('raw', key)));
}

/** Kết quả = iv(12) || ciphertext+tag. */
export async function encrypt(key: CryptoKey, plain: Uint8Array): Promise<Uint8Array> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

/** Ném lỗi nếu sai khóa hoặc dữ liệu bị sửa (xác thực AEAD thất bại). */
export async function decrypt(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = data.subarray(0, 12);
  const ct = data.subarray(12);
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource));
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await subtle.digest('SHA-256', data as BufferSource)));
}

export function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(b: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < b.length; i += CH) s += String.fromCharCode(...b.subarray(i, i + CH));
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
