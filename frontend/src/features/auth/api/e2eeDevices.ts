import type { ApiRequest } from '../../../shared/types/api'
import type { E2EEDeviceChallenge, E2EEDeviceRegistration, E2EEDeviceRevocation } from '../lib/e2eeIdentity'

export type E2EEPublicDevice = {
  deviceId: string
  identityKey: string
  label: string
  createdAt: string
}

// API intentionally remains experimental; do not enroll a generated identity
// before persisting its non-exportable private key on the trusted device.
export async function requestE2EEDeviceChallenge(request: ApiRequest): Promise<E2EEDeviceChallenge> {
  const response = await request('/api/auth/e2ee/challenge', { method: 'POST' })
  if (!response.ok) throw new Error('Không thể tạo thử thách xác minh thiết bị.')
  const value: E2EEDeviceChallenge = await response.json()
  if (!value?.challenge || !value?.sessionId || value.expiresInSeconds <= 0) {
    throw new Error('Phản hồi xác minh thiết bị không hợp lệ.')
  }
  return value
}

export async function registerE2EEDevice(
  request: ApiRequest,
  registration: E2EEDeviceRegistration,
): Promise<E2EEPublicDevice> {
  // A registration is one-shot: never automatically retry after an ambiguous result.
  const response = await request('/api/auth/e2ee/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration),
  })
  if (!response.ok) throw new Error('Không thể đăng ký khóa thiết bị E2EE.')
  return response.json()
}

export async function revokeE2EEDevice(
  request: ApiRequest,
  targetDeviceId: string,
  revocation: E2EEDeviceRevocation,
): Promise<void> {
  // Irreversible and challenge-consuming; never automatically retry.
  const response = await request(
    `/api/auth/e2ee/devices/${encodeURIComponent(targetDeviceId)}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(revocation),
    },
  )
  if (!response.ok) throw new Error('Không thể thu hồi khóa thiết bị E2EE.')
}

export async function listE2EEDevices(
  request: ApiRequest,
  userId?: number,
): Promise<E2EEPublicDevice[]> {
  const path = userId === undefined ? '/api/auth/e2ee/devices' :
    `/api/auth/e2ee/users/${encodeURIComponent(userId)}/devices`
  const response = await request(path)
  if (!response.ok) throw new Error('Không thể tải danh sách khóa công khai.')
  return response.json()
}
