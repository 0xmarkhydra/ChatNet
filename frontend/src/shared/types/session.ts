export type Session = {
  token: string
  refreshToken?: string
  sessionId: string
  user: { id: number; email: string; username: string; displayName: string }
}

export type ManagedAccountSession = {
  id: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}
