export type ApiErrorKind =
  | 'http'
  | 'network'
  | 'session-expired'
  | 'session-changed'
  | 'ambiguous-mutation'

export class ApiRequestError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ApiRequestError'
  }
}

const SESSION_CHANGED = 'Phiên đăng nhập đã thay đổi.'
const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn.'
const AMBIGUOUS_MUTATION = 'Chưa xác nhận được kết quả. Kiểm tra dữ liệu trước khi thử lại.'

/** Classify failures without treating an unconfirmed write as safe to replay. */
export function classifyApiError(error: unknown, mutation = false): ApiRequestError {
  if (error instanceof ApiRequestError) return error
  if (error instanceof Error && error.message === SESSION_CHANGED) {
    return new ApiRequestError('session-changed', error.message, undefined, { cause: error })
  }
  if (error instanceof Error && error.message === SESSION_EXPIRED) {
    return new ApiRequestError('session-expired', error.message, undefined, { cause: error })
  }
  if (mutation) {
    return new ApiRequestError('ambiguous-mutation', AMBIGUOUS_MUTATION, undefined, { cause: error })
  }
  return new ApiRequestError('network', error instanceof Error ? error.message : 'Không thể kết nối.', undefined, { cause: error })
}

/** Does not read or consume the response body. HTTP 401 is distinct from a transport exception. */
export function httpApiError(response: Response): ApiRequestError | null {
  if (response.ok) return null
  return new ApiRequestError(
    response.status === 401 ? 'session-expired' : 'http',
    response.status === 401 ? SESSION_EXPIRED : `HTTP ${response.status}`,
    response.status,
  )
}

/** Preserve the historical Response-returning mutation API for existing call sites. */
export function legacyMutationFailure(error: unknown): Response {
  const classified = classifyApiError(error, true)
  return Response.json(
    { error: classified.kind === 'session-changed' ? SESSION_CHANGED : AMBIGUOUS_MUTATION },
    { status: 503 },
  )
}
