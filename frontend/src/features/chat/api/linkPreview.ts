import type { ApiRequest } from "../../../shared/types/api";

export function fetchLinkPreview(request: ApiRequest, url: string) {
  return request(`/api/link-preview?url=${encodeURIComponent(url)}`);
}
