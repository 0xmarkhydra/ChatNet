// Public type contracts for consumers outside the contacts feature.
export type { FriendConnection, FriendSearchResult } from './types'
export { default as ContactsView } from './components/ContactsView'
export type { FriendsScreen } from './components/ContactsView'
export { default as BlockedUsersPanel } from './components/BlockedUsersPanel'
export { listContactMetadata, updateContactMetadata } from './api/contacts'
export { toContactMetadataIndex, type PersonalContactMetadata } from './utils/contactMetadata'
