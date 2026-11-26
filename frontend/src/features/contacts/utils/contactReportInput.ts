/** Exact API values accepted by the user-report endpoint. */
export type ContactReportReason = "spam" | "harassment" | "impersonation" | "other";

export function parseContactReportReason(choice: string): ContactReportReason | null {
  switch (choice.trim()) {
    case "1": return "spam";
    case "2": return "harassment";
    case "3": return "impersonation";
    case "4": return "other";
    default: return null;
  }
}

export function parseContactReportDetails(value: string): string | null {
  if (value.length > 1000) return null;
  return value.trim();
}
