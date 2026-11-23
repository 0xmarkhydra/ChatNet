import type { ApiRequest } from '../types/api'

type TicketResponse = { ticket?: unknown }

class SseTicketError extends Error {
	constructor(message: string, readonly retryable: boolean, readonly retryAfterMs?: number) {
		super(message)
	}
}

function parseRetryAfter(value: string | null): number | undefined {
	if (!value) return undefined
	const seconds = Number(value)
	if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 300_000)
	const date = Date.parse(value)
	return Number.isFinite(date) ? Math.min(Math.max(0, date - Date.now()), 300_000) : undefined
}

export async function requestSseTicket(apiFetch: ApiRequest, signal?: AbortSignal): Promise<string> {
	const response = await apiFetch('/api/events/ticket', { method: 'POST', signal })
	if (!response.ok) {
		const retryable = response.status === 408 || response.status === 429 || response.status >= 500
		throw new SseTicketError('realtime ticket unavailable', retryable, parseRetryAfter(response.headers.get('Retry-After')))
	}
	const body = await response.json() as TicketResponse
	if (typeof body.ticket !== 'string' || body.ticket.length < 32) {
		throw new SseTicketError('invalid realtime ticket', false)
	}
	return body.ticket
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			signal.removeEventListener('abort', abort)
			resolve()
		}, delayMs)
		const abort = () => {
			clearTimeout(timeout)
			signal.removeEventListener('abort', abort)
			reject(new DOMException('The operation was aborted.', 'AbortError'))
		}
		if (signal.aborted) abort()
		else signal.addEventListener('abort', abort, { once: true })
	})
}

export async function requestSseTicketWithRetry(apiFetch: ApiRequest, signal: AbortSignal, initialDelayMs = 0): Promise<string> {
	if (initialDelayMs > 0) await waitForRetry(initialDelayMs, signal)
	const maxAttempts = 5
	for (let attempt = 0; attempt < maxAttempts && !signal.aborted; attempt += 1) {
		try {
			return await requestSseTicket(apiFetch, signal)
		} catch (error) {
			if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
			if (error instanceof SseTicketError && !error.retryable) throw error
			if (attempt === maxAttempts - 1) throw error
			const backoffMs = Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000)
			const serverDelay = error instanceof SseTicketError ? error.retryAfterMs : undefined
			await waitForRetry(Math.max(backoffMs, serverDelay ?? 0), signal)
		}
	}
	throw new DOMException('The operation was aborted.', 'AbortError')
}
