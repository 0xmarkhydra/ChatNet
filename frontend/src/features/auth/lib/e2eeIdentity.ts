// Experimental device identity proof for future MLS enrollment.
// The caller must securely persist the non-exportable private CryptoKey before
// registering a device. No key is sent to ChatNet servers.
export type E2EEDeviceIdentity = {
  publicKey: string
  privateKey: CryptoKey
}

export type E2EEDeviceChallenge = {
  challenge: string
  sessionId: string
  expiresInSeconds: number
}

export type E2EEDeviceRegistration = {
  deviceId: string
  identityKey: string
  signature: string
  challenge: string
  label: string
}

export type ClaimedE2EEKeyPackage = {
  userId: number
  deviceId: string
  packageId: string
  package: string
  sessionId: string
  challenge: string
  signature: string
}

// Identity publicKey MUST have already been verified out-of-band/pinned by the
// recipient (QR/safety number or a reviewed transparency mechanism). Never use
// a public key copied from the same untrusted KeyPackage response as proof.
export async function verifyClaimedE2EEKeyPackage(
  claimed: ClaimedE2EEKeyPackage,
  expected: { userId: number; deviceId: string; verifiedIdentityPublicKey: string },
): Promise<Uint8Array> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  if (!Number.isSafeInteger(claimed.userId) || claimed.userId <= 0 ||
      claimed.userId !== expected.userId ||
      !uuid.test(claimed.deviceId) || claimed.deviceId !== expected.deviceId ||
      !uuid.test(claimed.packageId) || !uuid.test(claimed.sessionId)) {
    throw new Error('MLS KeyPackage owner/device mismatch')
  }
  const parse = (encoded: string, size?: number): Uint8Array<ArrayBuffer> => {
    if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > 22000) {
      throw new Error('Invalid MLS attestation encoding')
    }
    const raw = new Uint8Array(Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
      char => char.charCodeAt(0)))
    if (size !== undefined && raw.length !== size || base64url(raw) !== encoded) {
      throw new Error('Invalid MLS attestation length/encoding')
    }
    return raw
  }
  const payload = parse(claimed.package)
  if (payload.length < 64 || payload.length > 16384) {
    throw new Error('Invalid MLS KeyPackage size')
  }
  const challenge = parse(claimed.challenge, 32)
  const signature = parse(claimed.signature, 64)
  const knownIdentity = parse(expected.verifiedIdentityPublicKey, 32)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload))
  const transcript = [
    'chatnet:e2ee:keypackage:publish:v1',
    String(claimed.userId), claimed.sessionId, claimed.deviceId,
    claimed.packageId, base64url(digest), base64url(challenge),
  ].join('\n')
  const key = await crypto.subtle.importKey('raw', knownIdentity, 'Ed25519', false, ['verify'])
  if (!await crypto.subtle.verify(
    'Ed25519', key, signature, new TextEncoder().encode(transcript),
  )) {
    throw new Error('MLS KeyPackage was not signed by the verified device')
  }
  return payload
}

export type E2EEDeviceRevocation = {
  authorizingDeviceId: string
  challenge: string
  signature: string
}

export async function signE2EEDeviceRevocation(
  identity: E2EEDeviceIdentity,
  userId: number,
  authorizingDeviceId: string,
  targetDeviceId: string,
  challenge: E2EEDeviceChallenge,
): Promise<E2EEDeviceRevocation> {
  if (!Number.isSafeInteger(userId) || userId <= 0 ||
      !/^[0-9a-f-]{36}$/.test(authorizingDeviceId) ||
      !/^[0-9a-f-]{36}$/.test(targetDeviceId) ||
      !/^[0-9a-f-]{36}$/.test(challenge.sessionId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge.challenge)) {
    throw new Error('Invalid E2EE device revocation')
  }
  const transcript = [
    'chatnet:e2ee:device:revoke:v1', String(userId), challenge.sessionId,
    targetDeviceId, authorizingDeviceId, challenge.challenge,
  ].join('\n')
  const signature = await crypto.subtle.sign(
    'Ed25519', identity.privateKey, new TextEncoder().encode(transcript),
  )
  return { authorizingDeviceId, challenge: challenge.challenge,
    signature: base64url(new Uint8Array(signature)) }
}

export type E2EEKeyPackagePublication = {
  deviceId: string
  packageId: string
  package: string
  challenge: string
  signature: string
}

export async function signE2EEKeyPackage(
  identity: E2EEDeviceIdentity,
  userId: number,
  deviceId: string,
  challenge: E2EEDeviceChallenge,
  mlsKeyPackage: Uint8Array,
): Promise<E2EEKeyPackagePublication> {
  if (!Number.isSafeInteger(userId) || userId <= 0 ||
      !/^[0-9a-f-]{36}$/.test(deviceId) ||
      !/^[0-9a-f-]{36}$/.test(challenge.sessionId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge.challenge) ||
      mlsKeyPackage.byteLength < 64 || mlsKeyPackage.byteLength > 16384) {
    throw new Error('Invalid MLS KeyPackage publication')
  }
  // The MLS library must construct, sign and later verify actual KeyPackages.
  // This function authenticates transport bytes; it does NOT validate MLS.
  const payload = new Uint8Array(mlsKeyPackage)
  const digest = await crypto.subtle.digest('SHA-256', payload)
  const publication = {
    deviceId,
    packageId: crypto.randomUUID(),
    package: base64url(payload),
    challenge: challenge.challenge,
  }
  const transcript = [
    'chatnet:e2ee:keypackage:publish:v1',
    String(userId), challenge.sessionId, publication.deviceId, publication.packageId,
    base64url(new Uint8Array(digest)), publication.challenge,
  ].join('\n')
  const signature = await crypto.subtle.sign(
    'Ed25519', identity.privateKey, new TextEncoder().encode(transcript),
  )
  return { ...publication, signature: base64url(new Uint8Array(signature)) }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function generateE2EEDeviceIdentity(): Promise<E2EEDeviceIdentity> {
  const pair = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify'])
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey)
  if (pair.privateKey.extractable) throw new Error('E2EE private key must not be exportable')
  return { publicKey: base64url(new Uint8Array(raw)), privateKey: pair.privateKey }
}

export async function signE2EEDeviceRegistration(
  identity: E2EEDeviceIdentity,
  userId: number,
  challenge: E2EEDeviceChallenge,
  label: string,
  deviceId: string = crypto.randomUUID(),
): Promise<E2EEDeviceRegistration> {
  if (!Number.isSafeInteger(userId) || userId <= 0 ||
      !/^[0-9a-f-]{36}$/.test(challenge.sessionId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge.challenge) ||
      label.length > 80 || label.trim() !== label) {
    throw new Error('Invalid E2EE registration challenge')
  }
  const registration = {
    deviceId,
    identityKey: identity.publicKey,
    challenge: challenge.challenge,
    label,
  }
  // Must be byte-for-byte identical to the Go enrollment transcript.
  const transcript = [
    'chatnet:e2ee:register:v1', String(userId), challenge.sessionId,
    registration.deviceId, registration.identityKey, registration.challenge, registration.label,
  ].join('\n')
  const signature = await crypto.subtle.sign(
    'Ed25519', identity.privateKey, new TextEncoder().encode(transcript),
  )
  return { ...registration, signature: base64url(new Uint8Array(signature)) }
}
