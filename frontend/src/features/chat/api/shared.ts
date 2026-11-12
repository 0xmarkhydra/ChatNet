import type { ApiRequest } from "../../../shared/types/api";

export function getSharedContent(
  request: ApiRequest,
  query: { conversationId: number; channelId: number; kind: string; limit: number; before?: number },
  signal?: AbortSignal,
) {
  const suffix = query.before ? "&before=" + query.before : "";
  return request(
    "/api/conversations/" + query.conversationId + "/shared?kind=" + query.kind + "&channelId=" + query.channelId + "&limit=" + query.limit + suffix,
    { signal, cache: "no-store" },
  );
}

export function getHistoryBatch(
  request: ApiRequest,
  query: { conversationId: number; channelId: number; limit: number; cursor?: number },
  signal?: AbortSignal,
) {
  return request(
    "/api/conversations/" + query.conversationId + "/messages?channelId=" + query.channelId + "&limit=" + query.limit +
      (query.cursor ? "&before=" + query.cursor : ""),
    { signal, cache: "no-store" },
  );
}
