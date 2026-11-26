export type PersonalContactMetadata = { nickname: string; note: string; favorite: boolean };

/** Parse the contact metadata list without trusting unvalidated response fields. */
export function toContactMetadataIndex(records: unknown): Record<number, PersonalContactMetadata> | null {
  if (!Array.isArray(records)) return null;
  const index: Record<number, PersonalContactMetadata> = Object.create(null);
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const item = record as Record<string, unknown>;
    if (!Number.isSafeInteger(item.id) || (item.id as number) <= 0) continue;
    index[item.id as number] = {
      nickname: typeof item.nickname === "string" ? item.nickname : "",
      note: typeof item.note === "string" ? item.note : "",
      favorite: item.favorite === true,
    };
  }
  return index;
}
