import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_CHUNK_BYTES, decryptAttachment, encryptAttachment,
  type EncryptedAttachmentManifest,
} from './attachmentCrypto'

function sampleFile(bytes: number): File {
  const data = new Uint8Array(bytes)
  for (let i = 0; i < bytes; i++) data[i] = (i * 73 + 31) % 256
  return new File([data], 'hợp đồng nội bộ.pdf', { type: 'application/pdf' })
}

describe('E2EE attachment cipher (not wired to production uploads)', () => {
  it.each([100, ATTACHMENT_CHUNK_BYTES + 19])(
    'round trips %i plaintext bytes without putting raw content in S3 payload',
    async size => {
      const file = sampleFile(size)
      const { ciphertext, manifest, fileKey } = await encryptAttachment(file)
      expect(ciphertext.type).toBe('application/octet-stream')
      expect(ciphertext.size).toBe(size + manifest.chunkCount * 16)
      expect(manifest.name).toBe(file.name)
      expect(fileKey).toHaveLength(32)
      const recovered = await decryptAttachment(ciphertext, manifest, fileKey)
      expect(recovered.type).toBe(file.type)
      expect(Buffer.compare(Buffer.from(await recovered.arrayBuffer()), Buffer.from(await file.arrayBuffer()))).toBe(0)
    },
  )

  it('rejects tampered ciphertext, foreign keys and changed authenticated metadata', async () => {
    const encrypted = await encryptAttachment(sampleFile(90))
    const bytes = new Uint8Array(await encrypted.ciphertext.arrayBuffer())
    bytes[bytes.length - 1] ^= 1
    await expect(decryptAttachment(new Blob([bytes]), encrypted.manifest, encrypted.fileKey)).rejects.toThrow()

    const wrong = crypto.getRandomValues(new Uint8Array(32))
    await expect(decryptAttachment(encrypted.ciphertext, encrypted.manifest, wrong)).rejects.toThrow()

    const modified: EncryptedAttachmentManifest = { ...encrypted.manifest, name: 'changed.pdf' }
    await expect(decryptAttachment(encrypted.ciphertext, modified, encrypted.fileKey)).rejects.toThrow()
  })

  it('rejects truncation, appended bytes, malformed nonce, unsupported size and empty file', async () => {
    const encrypted = await encryptAttachment(sampleFile(150))
    const { ciphertext, manifest, fileKey } = encrypted
    await expect(decryptAttachment(ciphertext.slice(0, -1), manifest, fileKey)).rejects.toThrow()
    await expect(decryptAttachment(new Blob([ciphertext, Uint8Array.of(0)]), manifest, fileKey)).rejects.toThrow()
    await expect(decryptAttachment(ciphertext, { ...manifest, noncePrefix: '__invalid' }, fileKey)).rejects.toThrow()
    await expect(decryptAttachment(ciphertext, { ...manifest, chunkCount: 100 }, fileKey)).rejects.toThrow()
    await expect(encryptAttachment(new File([], 'empty.pdf'))).rejects.toThrow()
  })

  it('uses a distinct fresh key per file', async () => {
    const source = sampleFile(16)
    const one = await encryptAttachment(source)
    const two = await encryptAttachment(source)
    expect(Buffer.from(one.fileKey).equals(Buffer.from(two.fileKey))).toBe(false)
    expect(one.manifest.noncePrefix).not.toBe(two.manifest.noncePrefix)
    await expect(decryptAttachment(one.ciphertext, one.manifest, two.fileKey)).rejects.toThrow()
  })
})
