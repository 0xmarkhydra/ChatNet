import { afterEach, expect, it, vi } from "vitest"
import { requestFeedTranslation } from "./translation"

afterEach(() => vi.unstubAllGlobals())

it("posts the authenticated translation request and returns the original response", async () => {
  const controller = new AbortController()
  const response = new Response("unavailable", { status: 503 })
  const fetcher = vi.fn().mockResolvedValue(response)
  vi.stubGlobal("fetch", fetcher)

  const result = await requestFeedTranslation({
    api: "https://translate.example.invalid",
    token: "test-token",
    text: "Original text",
    target: "vi",
    signal: controller.signal,
  })

  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith("https://translate.example.invalid/api/translate", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Original text", target: "vi" }),
    signal: controller.signal,
  })
  expect(result).toBe(response)
})

it("preserves network errors for caller retry handling", async () => {
  const error = new TypeError("Failed to fetch")
  const fetcher = vi.fn().mockRejectedValue(error)
  vi.stubGlobal("fetch", fetcher)

  await expect(requestFeedTranslation({
    api: "https://translate.example.invalid",
    token: "test-token",
    text: "Original text",
    target: "vi",
    signal: new AbortController().signal,
  })).rejects.toBe(error)
})
