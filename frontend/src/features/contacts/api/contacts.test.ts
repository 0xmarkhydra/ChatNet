import { expect, it, vi } from "vitest";
import { listContactMetadata, listFriendRequests, listFriends, listFriendSuggestions, searchFriendUsers, listBlockedUsers } from "./contacts";

it("forwards cancellation signals to all independent contacts GET endpoints", async () => {
  const controller = new AbortController();
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json([]));
  await Promise.all([
    listFriends(request, controller.signal),
    listFriendRequests(request, controller.signal),
    listContactMetadata(request, controller.signal),
  ]);
  expect(request.mock.calls.map(([path, init]) => [path, init?.cache, init?.signal])).toEqual([
    ["/api/friends", "no-store", controller.signal],
    ["/api/friends/requests", "no-store", controller.signal],
    ["/api/contacts", "no-store", controller.signal],
  ]);
  controller.abort();
  expect(request.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
});

it("keeps the original endpoint and cache behavior when a signal is not supplied", async () => {
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json([]));
  await listFriends(request);
  await listFriendRequests(request);
  await listContactMetadata(request);
  expect(request.mock.calls.map(([path, init]) => [path, init?.cache])).toEqual([
    ["/api/friends", "no-store"],
    ["/api/friends/requests", "no-store"],
    ["/api/contacts", "no-store"],
  ]);
});
it("centralizes friend search URLs, encoding and cancellation in Contacts API", async () => {
  const controller = new AbortController();
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json([]));
  await listFriendSuggestions(request, controller.signal);
  await searchFriendUsers(request, "a b&c", controller.signal);
  expect(request.mock.calls.map(([path, init]) => [path, init?.signal])).toEqual([
    ["/api/users/suggestions", controller.signal],
    ["/api/users/search?q=a%20b%26c", controller.signal],
  ]);
});
it("forwards blocked-list cancellation without changing the URL", async () => {
  const controller = new AbortController();
  const request = vi.fn(async (_path: string, _init?: RequestInit) => Response.json([]));
  await listBlockedUsers(request, controller.signal);
  expect(request).toHaveBeenCalledWith("/api/users/blocked", { signal: controller.signal });
});
