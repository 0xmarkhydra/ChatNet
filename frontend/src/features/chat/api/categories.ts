import type { ApiRequest } from "../../../shared/types/api";

export function listCategories(request: ApiRequest, force: boolean) {
  return request("/api/conversation-categories", force ? { cache: "reload" } : {});
}

export function saveCategory(request: ApiRequest, value: unknown, id?: number) {
  return request("/api/conversation-categories" + (id ? "/" + id : ""), {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(value),
  });
}

export function deleteCategory(request: ApiRequest, id: number) {
  return request("/api/conversation-categories/" + id, { method: "DELETE" });
}

export function assignCategory(request: ApiRequest, conversationId: number, categoryId: number | null) {
  return request("/api/conversations/" + conversationId + "/category", {
    method: "PUT",
    body: JSON.stringify({ categoryId }),
  });
}
