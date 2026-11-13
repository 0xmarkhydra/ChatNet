import type { ApiRequest } from '../../../shared/types/api'
import type { ClaimedE2EEKeyPackage, E2EEKeyPackagePublication } from '../lib/e2eeIdentity'

export type E2EEClaimedKeyPackage = ClaimedE2EEKeyPackage & {
  expiresAt: string
}

export async function publishE2EEKeyPackage(
  request: ApiRequest,
  publication: E2EEKeyPackagePublication,
): Promise<{ deviceId: string; packageId: string; expiresAt: string }> {
  // Publishing consumes a challenge; don't automatically retry ambiguous writes.
  const response = await request('/api/auth/e2ee/key-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(publication),
  })
  if (!response.ok) throw new Error('Không thể xuất bản MLS KeyPackage.')
  return response.json()
}

export async function claimE2EEKeyPackage(
  request: ApiRequest,
  target: { userId: number; deviceId: string },
): Promise<E2EEClaimedKeyPackage> {
  // Claim is destructive: never auto-retry after a network timeout.
  const response = await request('/api/auth/e2ee/key-packages/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  })
  if (!response.ok) throw new Error('Không có MLS KeyPackage hợp lệ để nhận.')
  return response.json()
}
