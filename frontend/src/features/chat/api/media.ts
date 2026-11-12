import type { ApiRequest } from "../../../shared/types/api";

export function presignUpload(
  request: ApiRequest,
  upload: { scope: string; name: string; sizeBytes: number; contentType: string },
  signal: AbortSignal,
) {
  return request("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: upload.scope,
      name: upload.name,
      sizeBytes: upload.sizeBytes,
      contentType: upload.contentType,
    }),
    signal,
  });
}

export function relayUpload(
  request: ApiRequest,
  upload: { storageRef: string; relayToken: string; contentType: string; body: Blob },
  signal: AbortSignal,
) {
  return request("/api/media/relay?ref=" + encodeURIComponent(upload.storageRef), {
    method: "PUT",
    headers: {
      "Content-Type": upload.contentType,
      "X-ChatNet-Relay-Token": upload.relayToken,
    },
    body: upload.body,
    signal,
  });
}
