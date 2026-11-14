export type { ManagedAccountSession } from './types'
export { verifyClaimedE2EEKeyPackage } from './lib/e2eeIdentity'
export type { ClaimedE2EEKeyPackage } from './lib/e2eeIdentity'
export type { Session } from '../../shared/types/session'
// Public Auth capability boundary for ChatNet's experimental MLS pilot.
// Cross-feature consumers must use this entrypoint, not Auth implementation paths.
export { generateE2EEDeviceIdentity, signE2EEDeviceRegistration, signE2EEKeyPackage } from './lib/e2eeIdentity'
export type { E2EEDeviceIdentity } from './lib/e2eeIdentity'
export { listE2EEDevices, registerE2EEDevice, requestE2EEDeviceChallenge } from './api/e2eeDevices'
export type { E2EEPublicDevice } from './api/e2eeDevices'
export { claimE2EEKeyPackage, publishE2EEKeyPackage } from './api/e2eeKeyPackages'
export { listLocalE2EEDeviceIDs, loadLocalE2EEIdentity, saveLocalE2EEIdentity } from './lib/e2eeKeyStore'
