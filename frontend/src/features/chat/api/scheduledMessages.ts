import type { ApiRequest } from "@/shared/types/api"

export type ScheduledMessage = {
  id: number
  text?: string
  sendAt: string
  channelId?: number
  state: "pending" | "sent" | "cancelled" | "failed"
}

const queuePath = (conversationId: number) => `/api/conversations/${conversationId}/scheduled-messages`
const jsonHeaders = { "Content-Type": "application/json" }

async function check(response: Response) {
  if (response.ok) return response
  if (response.status === 403) throw new Error("Bạn không còn quyền thao tác trong cuộc trò chuyện này.")
  if (response.status === 404) throw new Error("Không tìm thấy lịch gửi đang chờ. Hãy tải lại hàng chờ.")
  if (response.status === 409) throw new Error("Không thể lên lịch cho cuộc trò chuyện mã hóa đầu cuối hoặc yêu cầu đã xung đột.")
  if (response.status === 429) throw new Error("Hàng chờ đã đầy. Hãy hủy bớt lịch gửi rồi thử lại.")
  if (response.status === 400) throw new Error("Nội dung hoặc thời gian gửi không hợp lệ.")
  throw new Error("Không thể xác nhận kết quả. Hãy tải lại hàng chờ trước khi tạo lịch mới.")
}

export async function listScheduledMessages(request: ApiRequest, conversationId: number, signal?: AbortSignal) {
  const response = await check(await request(queuePath(conversationId), { cache: "no-store", signal }))
  return await response.json() as ScheduledMessage[]
}

export async function createScheduledMessage(request: ApiRequest, conversationId: number, input: {
  text: string
  sendAt: string
  channelId?: number
  clientId: string
}) {
  const response = await check(await request(queuePath(conversationId), {
    method: "POST", headers: jsonHeaders, body: JSON.stringify(input),
  }))
  return await response.json() as ScheduledMessage
}

export async function moveScheduledMessage(request: ApiRequest, conversationId: number, id: number, sendAt: string) {
  const response = await check(await request(`${queuePath(conversationId)}/${id}`, {
    method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ sendAt }),
  }))
  return await response.json() as ScheduledMessage
}

export async function cancelScheduledMessage(request: ApiRequest, conversationId: number, id: number) {
  await check(await request(`${queuePath(conversationId)}/${id}`, { method: "DELETE" }))
}
