import { describe, expect, it } from "vitest"
import { scheduledInstant, scheduledLocalValue } from "./scheduledMessageTime"

describe("scheduled message local time", () => {
  it("preserves the selected local calendar time when sending UTC to the server", () => {
    const date = new Date(2027, 0, 21, 9, 30)
    const now = new Date(2027, 0, 21, 9).getTime()
    expect(scheduledLocalValue(date)).toBe("2027-01-21T09:30")
    expect(scheduledInstant("2027-01-21T09:30", now)).toBe(date.toISOString())
  })

  it("rejects impossible dates, past times and times beyond a year", () => {
    const now = new Date(2027, 0, 21, 9).getTime()
    for (const value of ["", "2027-02-30T09:30", "2027-01-21T09:00", "2028-02-01T09:00"]) {
      expect(scheduledInstant(value, now)).toBeNull()
    }
  })
})
