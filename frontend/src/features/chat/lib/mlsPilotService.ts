// Limited two-account / one-device-per-account MLS pilot for Web/PWA testing.
// NOT a production multi-device chat implementation or security certification.
import {
  generateE2EEDeviceIdentity, signE2EEDeviceRegistration, signE2EEKeyPackage,
  listE2EEDevices, registerE2EEDevice, requestE2EEDeviceChallenge,
  claimE2EEKeyPackage, publishE2EEKeyPackage,
  listLocalE2EEDeviceIDs, loadLocalE2EEIdentity, saveLocalE2EEIdentity,
  type E2EEDeviceIdentity, type E2EEPublicDevice,
} from '../../auth'
import {
  ExperimentalMLSTrust, addExperimentalMLSDevice,
  createExperimentalMLSCiphersuite, createExperimentalMLSDevice,
  createExperimentalMLSGroup, encryptExperimentalMLSMessage,
  joinExperimentalMLSGroup, receiveExperimentalMLSMessage,
  restoreExperimentalMLSDevice, trustAttestedExperimentalMLSPeer,
  type ExperimentalMLSDevice,
} from './mlsEngineExperimental'
import {
  getPinnedMLSPeer, listMLSLocalMessages, loadMLSDevicePackage,
  loadMLSPending, loadMLSState, persistMLSProgress, pinMLSPeer,
  saveMLSDevicePackage, type MLSLocalMessage, type MLSPending,
} from './mlsStateVault'
import {
  signMLSTransportEvent, verifyMLSTransportEvent,
  type ReceivedMLSEvent, type SignedMLSEvent,
} from './mlsTransport'
import { listMLSTransportEvents, publishMLSTransportEvent } from '../api/mlsTransport'
import type { ApiRequest } from '../../../shared/types/api'

export type PilotStatus = { mode: 'legacy' | 'e2ee'; epoch: number; pilotEnabled: boolean }

export async function fetchMLSPilotStatus(request: ApiRequest, conversationId: number): Promise<PilotStatus> {
  const response = await request(`/api/conversations/${conversationId}/e2ee/status`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Không kiểm tra được chế độ E2EE')
  const data: PilotStatus = await response.json()
  if (!data || !['legacy', 'e2ee'].includes(data.mode) ||
      !Number.isSafeInteger(data.epoch) || data.epoch < 0 ||
      typeof data.pilotEnabled !== 'boolean') {
    throw new Error('Trạng thái E2EE không hợp lệ')
  }
  return data
}

export async function identitySafetyCode(publicKey: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(publicKey)))
  const code = [...digest.slice(0, 12)].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

export class MLSPilotService {
  private local: { deviceId: string; identity: E2EEDeviceIdentity } | null = null

  constructor(
    private readonly request: ApiRequest,
    readonly userId: number,
    readonly otherUserId: number,
    readonly conversationId: number,
  ) {
    if (!Number.isSafeInteger(userId) || userId < 1 ||
        !Number.isSafeInteger(otherUserId) || otherUserId < 1 ||
        !Number.isSafeInteger(conversationId) || conversationId < 1 ||
        otherUserId === userId) {
      throw new Error('MLS pilot requires a valid private conversation')
    }
  }

  status(): Promise<PilotStatus> {
    return fetchMLSPilotStatus(this.request, this.conversationId)
  }

  async ownDevice(): Promise<{ deviceId: string; identity: E2EEDeviceIdentity } | null> {
    if (this.local) return this.local
    const ids = await listLocalE2EEDeviceIDs(this.userId)
    if (ids.length > 1) throw new Error('Nhiều khóa thiết bị cục bộ: cần chọn đúng thiết bị trước')
    if (!ids[0]) return null
    const identity = await loadLocalE2EEIdentity(this.userId, ids[0])
    if (!identity) throw new Error('Khóa thiết bị đã mất; không tự tạo lại để tránh tráo khóa')
    this.local = { deviceId: ids[0], identity }
    return this.local
  }

  async peerDevice(): Promise<E2EEPublicDevice | null> {
    const devices = await listE2EEDevices(this.request, this.otherUserId)
    if (devices.length > 1) {
      throw new Error('Bản thử nghiệm chỉ hỗ trợ một thiết bị của mỗi người')
    }
    return devices[0] ?? null
  }

  async pinnedPeer(): Promise<{ identityKey: string; mlsSigningKey?: string } | null> {
    const own = await this.ownDevice()
    const peer = await this.peerDevice()
    if (!own || !peer) return null
    const pinned = await getPinnedMLSPeer(this.userId, own.deviceId,
      this.otherUserId, peer.deviceId)
    if (pinned && pinned.identityKey !== peer.identityKey) {
      throw new Error('Khóa thiết bị của người nhận đã thay đổi! Cần xác minh lại ngoài ứng dụng.')
    }
    return pinned
  }

  async confirmPeerIdentity(): Promise<void> {
    const own = await this.ownDevice()
    const peer = await this.peerDevice()
    if (!own || !peer) throw new Error('Cả hai phải đăng ký thiết bị E2EE trước')
    // UI explicitly asks users to compare this fingerprint independently.
    await pinMLSPeer(this.userId, own.deviceId,
      this.otherUserId, peer.deviceId, peer.identityKey)
  }

  async prepareDevice(): Promise<string> {
    const status = await this.status()
    if (!status.pilotEnabled) throw new Error('Máy chủ chưa bật E2EE pilot')
    let own = await this.ownDevice()
    if (!own) {
      const identity = await generateE2EEDeviceIdentity()
      const deviceId = crypto.randomUUID()
      await saveLocalE2EEIdentity(this.userId, { ...identity, deviceId })
      this.local = { identity, deviceId }
      own = this.local
    }
    const registered = await listE2EEDevices(this.request)
    const matching = registered.find(d => d.deviceId === own.deviceId)
    if (matching && matching.identityKey !== own.identity.publicKey) {
      throw new Error('Danh bạ thiết bị không khớp khóa đang lưu')
    }
    if (!matching) {
      // Enrollment proof is bound to the active JWT session.
      const challenge = await requestE2EEDeviceChallenge(this.request)
      const signed = await signE2EEDeviceRegistration(own.identity, this.userId,
        challenge, 'SOCO Web/PWA', own.deviceId)
      await registerE2EEDevice(this.request, signed)
    }
    let saved = await loadMLSDevicePackage(this.userId, own.deviceId)
    if (!saved) {
      const suite = await createExperimentalMLSCiphersuite()
      const device = await createExperimentalMLSDevice(this.userId, own.deviceId, suite)
      // Sealed on disk BEFORE publishing its corresponding public KeyPackage.
      await saveMLSDevicePackage(this.userId, own.deviceId,
        device.keyPackageBytes, device.privatePackage)
      saved = { keyPackageBytes: device.keyPackageBytes, privatePackage: device.privatePackage }
    }
    // Only one per local device in the pilot; republishing same package is
    // allowed when an ACK was lost. Keep the private part sealed locally.
    const current = await requestE2EEDeviceChallenge(this.request)
    const signedPackage = await signE2EEKeyPackage(own.identity, this.userId,
      own.deviceId, current, saved.keyPackageBytes)
    await publishE2EEKeyPackage(this.request, signedPackage)
    return own.deviceId
  }

  private async ownMLSPackage(): Promise<ExperimentalMLSDevice> {
    const own = await this.ownDevice()
    if (!own) throw new Error('Thiết bị này chưa được đăng ký E2EE')
    const saved = await loadMLSDevicePackage(this.userId, own.deviceId)
    if (!saved) throw new Error('Thiếu khóa MLS cục bộ; hãy chuẩn bị thiết bị')
    const suite = await createExperimentalMLSCiphersuite()
    return restoreExperimentalMLSDevice(this.userId, own.deviceId,
      saved.keyPackageBytes, saved.privatePackage, suite)
  }

  private async buildTrust(): Promise<ExperimentalMLSTrust> {
    const own = await this.ownMLSPackage()
    const peer = await this.peerDevice()
    const pinned = await this.pinnedPeer()
    if (!peer || !pinned) throw new Error('Chưa xác minh mã an toàn của người nhận')
    const trust = new ExperimentalMLSTrust()
    trust.authorize(this.userId, own.deviceId,
      own.publicPackage.leafNode.signaturePublicKey)
    if (pinned.mlsSigningKey) {
      trust.authorize(this.otherUserId, peer.deviceId,
        new Uint8Array(Uint8Array.from(
          atob(pinned.mlsSigningKey.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0),
        )))
    }
    return trust
  }

  private async claimRemotePackage(trust: ExperimentalMLSTrust): Promise<Uint8Array> {
    const own = await this.ownDevice()
    const peer = await this.peerDevice()
    const pinned = await this.pinnedPeer()
    if (!own || !peer || !pinned) throw new Error('Chưa xác minh thiết bị người nhận')
    const claim = await claimE2EEKeyPackage(this.request,
      { userId: this.otherUserId, deviceId: peer.deviceId })
    const suite = await createExperimentalMLSCiphersuite()
    const bytes = await trustAttestedExperimentalMLSPeer(claim, {
      userId: this.otherUserId,
      deviceId: peer.deviceId,
      pinnedDeviceIdentityPublicKey: pinned.identityKey,
    }, suite, trust)
    const signatureKey = await this.mlsSigningKeyOf(trust, bytes)
    await pinMLSPeer(this.userId, own.deviceId, this.otherUserId,
      peer.deviceId, pinned.identityKey, signatureKey)
    return bytes
  }

  private async mlsSigningKeyOf(_trust: ExperimentalMLSTrust, bytes: Uint8Array): Promise<string> {
    // Signature key is fetched from validated and attested MLS KeyPackage.
    const { decodeMlsMessage } = await import('ts-mls')
    const wire = decodeMlsMessage(bytes, 0)
    if (!wire || wire[1] !== bytes.length || wire[0].wireformat !== 'mls_key_package') {
      throw new Error('Invalid attested MLS KeyPackage')
    }
    const raw = wire[0].keyPackage.leafNode.signaturePublicKey
    let data = ''
    raw.forEach(b => { data += String.fromCharCode(b) })
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async pilotApprovals(): Promise<{ ownApproved: boolean; peerApproved: boolean }> {
    const response = await this.request(
      `/api/conversations/${this.conversationId}/e2ee/consents`, { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Không tải được trạng thái đồng ý E2EE')
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' ||
        !('ownApproved' in result) || typeof result.ownApproved !== 'boolean' ||
        !('peerApproved' in result) || typeof result.peerApproved !== 'boolean') {
      throw new Error('Trạng thái đồng ý E2EE không hợp lệ')
    }
    return { ownApproved: result.ownApproved, peerApproved: result.peerApproved }
  }

  async approvePilot(): Promise<void> {
    const own = await this.ownDevice()
    if (!own || !await this.pinnedPeer()) {
      throw new Error('Cần chuẩn bị và xác minh khóa người nhận trước khi đồng ý')
    }
    const response = await this.request(
      `/api/conversations/${this.conversationId}/e2ee/consents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: own.deviceId }),
      },
    )
    if (!response.ok) throw new Error('Không thể ghi nhận đồng ý chuyển sang E2EE')
  }

  async startConversation(): Promise<void> {
    const current = await this.status()
    if (!current.pilotEnabled || current.mode !== 'legacy' || current.epoch !== 0) {
      throw new Error('Cuộc trò chuyện đã chuyển sang chế độ khác')
    }
    const approvals = await this.pilotApprovals()
    if (!approvals.ownApproved || !approvals.peerApproved) {
      throw new Error('Cả hai thành viên phải đồng ý chuyển sang E2EE')
    }
    const own = await this.ownDevice()
    if (!own) throw new Error('Cần chuẩn bị thiết bị trước')
    if (await loadMLSPending(this.userId, own.deviceId, this.conversationId)) {
      await this.flushPending()
      return
    }
    if (await loadMLSState(this.userId, own.deviceId, this.conversationId,
      (await this.buildTrust()).config)) {
      throw new Error('Đã có khóa MLS cục bộ; cần đồng bộ trước khi bắt đầu lại')
    }
    const trust = await this.buildTrust()
    const peer = await this.peerDevice()
    if (!peer) throw new Error('Người nhận chưa đăng ký E2EE')
    const suite = await createExperimentalMLSCiphersuite()
    const remotePackage = await this.claimRemotePackage(trust)
    const ownPackage = await this.ownMLSPackage()
    const group = await createExperimentalMLSGroup(
      this.conversationId, ownPackage, suite, trust)
    const added = await addExperimentalMLSDevice(
      group, remotePackage, this.otherUserId, peer.deviceId, trust)
    const commit = await signMLSTransportEvent({
      userId: this.userId, conversationId: this.conversationId, deviceId: own.deviceId,
      privateKey: own.identity.privateKey, eventType: 'commit', epoch: 1,
      mlsWireMessage: added.commit,
    })
    const welcome = await signMLSTransportEvent({
      userId: this.userId, conversationId: this.conversationId, deviceId: own.deviceId,
      privateKey: own.identity.privateKey, eventType: 'welcome', epoch: 1,
      targetDeviceId: peer.deviceId, mlsWireMessage: added.welcome,
    })
    await persistMLSProgress(this.userId, own.deviceId, this.conversationId,
      added.next.state, 0, 0, { pending: { kind: 'bootstrap', commit, welcome } })
    await this.flushPending()
  }

  private async publishBootstrap(commit: SignedMLSEvent, welcome: SignedMLSEvent): Promise<{
    commitId: number
    welcomeId: number
  }> {
    const response = await this.request(
      `/api/conversations/${this.conversationId}/e2ee/bootstrap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit, welcome }),
      },
    )
    if (!response.ok) throw new Error(
      response.status === 409 ? 'Hội thoại đã được khởi tạo trên thiết bị khác.' :
        'Không thể tạo nhóm E2EE; khóa thử nghiệm đang chờ đồng bộ lại.',
    )
    return response.json()
  }

  async flushPending(): Promise<void> {
    const own = await this.ownDevice()
    if (!own) return
    const pending = await loadMLSPending(this.userId, own.deviceId, this.conversationId)
    if (!pending) return
    const trust = await this.buildTrust()
    const snapshot = await loadMLSState(this.userId, own.deviceId, this.conversationId, trust.config)
    if (!snapshot) throw new Error('Thiếu MLS state để tiếp tục bản tin đang chờ')
    if (pending.kind === 'bootstrap') {
      const response = await this.publishBootstrap(pending.commit, pending.welcome)
      await persistMLSProgress(this.userId, own.deviceId, this.conversationId,
        snapshot.state, snapshot.revision, response.welcomeId, { clearPending: true })
      return
    }
    const result = await publishMLSTransportEvent(
      this.request, this.conversationId, pending.event)
    await persistMLSProgress(this.userId, own.deviceId, this.conversationId,
      snapshot.state, snapshot.revision, snapshot.cursor, {
        clearPending: true,
        history: {
          id: result.id, senderId: this.userId, text: pending.text,
          createdAt: pending.createdAt, clientId: pending.event.clientId,
        },
      })
  }

  async send(text: string): Promise<void> {
    const clean = text.trim()
    if (!clean || [...clean].length > 4000) throw new Error('Tin nhắn tối đa 4000 ký tự')
    await this.flushPending()
    await this.sync(false)
    const current = await this.status()
    if (!current.pilotEnabled || current.mode !== 'e2ee') {
      throw new Error('Hội thoại chưa sẵn sàng gửi E2EE')
    }
    const own = await this.ownDevice()
    if (!own) throw new Error('Thiếu thiết bị mã hóa')
    const trust = await this.buildTrust()
    const state = await loadMLSState(this.userId, own.deviceId,
      this.conversationId, trust.config)
    if (!state || Number(state.state.groupContext.epoch) !== current.epoch) {
      throw new Error('MLS epoch không khớp; đồng bộ trước khi gửi')
    }
    const suite = await createExperimentalMLSCiphersuite()
    const encoded = new TextEncoder().encode(clean)
    const encrypted = await encryptExperimentalMLSMessage({
      state: state.state, suite,
    }, encoded)
    const event = await signMLSTransportEvent({
      userId: this.userId, conversationId: this.conversationId,
      deviceId: own.deviceId, privateKey: own.identity.privateKey,
      eventType: 'application', epoch: encrypted.epoch,
      mlsWireMessage: encrypted.ciphertext,
    })
    // The consumed ratchet and signed outbox must be committed atomically
    // BEFORE the request reaches the server. Lost ACKs retry this same event.
    await persistMLSProgress(this.userId, own.deviceId, this.conversationId,
      encrypted.next.state, state.revision, state.cursor, {
        pending: { kind: 'application', event, text: clean, createdAt: new Date().toISOString() },
      })
    await this.flushPending()
  }

  async sync(retryPending = true): Promise<MLSLocalMessage[]> {
    const own = await this.ownDevice()
    if (!own) return []
    if (retryPending) await this.flushPending()
    let trust = await this.buildTrust()
    let snapshot = await loadMLSState(this.userId, own.deviceId, this.conversationId, trust.config)
    const peer = await this.peerDevice()
    const pinned = await this.pinnedPeer()
    if (!peer || !pinned) throw new Error('Hãy xác minh mã an toàn của người nhận')
    const suite = await createExperimentalMLSCiphersuite()
    const self = await this.ownMLSPackage()

    // Cursor is persisted along with the decrypted ratchet and message log.
    // Never skip an event whose ciphertext has not been processed and saved.
    let cursor = snapshot?.cursor ?? 0
    for (let page = 0; page < 8; page++) {
      const response = await listMLSTransportEvents(
        this.request, this.conversationId, own.deviceId, cursor, 25,
      )
      if (!response.events.length) break
      for (const event of response.events) {
        if (event.id <= cursor) continue
        if (event.senderId !== this.userId && event.senderId !== this.otherUserId) {
          throw new Error('Tin E2EE đến từ thành viên không hợp lệ')
        }
        const sourceKey = event.senderId === this.userId
          ? own.identity.publicKey : pinned.identityKey
        const sourceDevice = event.senderId === this.userId
          ? own.deviceId : peer.deviceId
        if (event.deviceId !== sourceDevice) {
          throw new Error('Phát hiện thiết bị E2EE không thuộc phiên thử nghiệm')
        }
        const bytes = await verifyMLSTransportEvent(
          event, this.conversationId, event.senderId, sourceKey,
        )
        if (!snapshot) {
          if (event.eventType === 'welcome' && event.senderId === this.otherUserId &&
              event.targetDeviceId === own.deviceId) {
            if (!pinned.mlsSigningKey) {
              await this.claimRemotePackage(trust)
              trust = await this.buildTrust()
            }
            const joined = await joinExperimentalMLSGroup(
              this.conversationId, self, bytes, suite, trust)
            const revision = await persistMLSProgress(
              this.userId, own.deviceId, this.conversationId, joined.state, 0, event.id,
            )
            snapshot = { state: joined.state, revision, cursor: event.id }
            cursor = event.id
          }
          // The initial Commit is before the Welcome, and cannot be applied
          // until a prospective member has joined from the Welcome.
          continue
        }

        if (event.eventType === 'commit') {
          // Group membership / rekey policy for subsequent epochs has not
          // yet been built. Never accept arbitrary server-supplied commits.
          if (event.senderId !== this.userId || event.epoch !== 1) {
            throw new Error('MLS Commit mới cần xác minh thành viên và rekey.')
          }
        } else if (event.eventType === 'application' && event.senderId === this.otherUserId) {
          if (event.epoch !== Number(snapshot.state.groupContext.epoch)) {
            throw new Error('MLS application epoch không khớp')
          }
          const result = await receiveExperimentalMLSMessage({
            state: snapshot.state, suite,
          }, bytes)
          const text = new TextDecoder('utf-8', { fatal: true }).decode(result.plaintext)
          const revision = await persistMLSProgress(
            this.userId, own.deviceId, this.conversationId,
            result.next.state, snapshot.revision, event.id, {
              history: {
                id: event.id, senderId: event.senderId, text,
                createdAt: event.createdAt, clientId: event.clientId,
              },
            })
          snapshot = { state: result.next.state, revision, cursor: event.id }
          cursor = event.id
          continue
        }
        // Local outbound events have already consumed our sending ratchet.
        const revision = await persistMLSProgress(
          this.userId, own.deviceId, this.conversationId,
          snapshot.state, snapshot.revision, event.id,
        )
        snapshot = { ...snapshot, revision, cursor: event.id }
        cursor = event.id
      }
      if (response.events.length < 25) break
    }
    return listMLSLocalMessages(this.userId, own.deviceId, this.conversationId)
  }

  async localMessages(): Promise<MLSLocalMessage[]> {
    const own = await this.ownDevice()
    if (!own) return []
    return listMLSLocalMessages(this.userId, own.deviceId, this.conversationId)
  }

  async isReady(): Promise<boolean> {
    const own = await this.ownDevice()
    if (!own) return false
    const trust = await this.buildTrust()
    return !!await loadMLSState(this.userId, own.deviceId, this.conversationId, trust.config)
  }
}
