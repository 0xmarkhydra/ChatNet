import { expect, it } from "vitest";
import { toContactMetadataIndex } from "./contactMetadata";

it("indexes valid contact records without changing their values", () => {
  const records = [{ id: 3, nickname: "Bạn", note: "Kỷ niệm", favorite: true }, { id: 5, nickname: "", note: "", favorite: false }];
  const index = toContactMetadataIndex(records);
  expect(index?.[3]).toEqual({ nickname: "Bạn", note: "Kỷ niệm", favorite: true });
  expect(index?.[5]).toEqual({ nickname: "", note: "", favorite: false });
});

it("ignores invalid IDs and normalizes malformed fields without throwing", () => {
  const index = toContactMetadataIndex([
    null, {}, { id: -2, nickname: "invalid" }, { id: 2, nickname: null, note: 13, favorite: "true" }, { id: "__proto__", nickname: "unsafe" },
  ]);
  expect(Object.keys(index ?? {})).toEqual(["2"]);
  expect(index?.[2]).toEqual({ nickname: "", note: "", favorite: false });
  expect(Object.getPrototypeOf(index)).toBeNull();
});

it("does not erase existing metadata when the response is not a list", () => {
  expect(toContactMetadataIndex({ id: 3 })).toBeNull();
  expect(toContactMetadataIndex(null)).toBeNull();
});
