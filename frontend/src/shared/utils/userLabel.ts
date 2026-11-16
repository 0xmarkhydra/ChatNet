// A display label is never an account identifier or an authorization key.
export function userLabel(displayName?: string, username?: string): string {
  return displayName?.trim() || username?.trim() || 'Người dùng'
}
