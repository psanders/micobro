/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { businessClock, closeDue } from "../server/schedule";

describe("nightly close schedule", () => {
  it("reads the business date in the DR, not UTC", () => {
    // 02:00 UTC on the 4th is 22:00 on the 3rd in Santo Domingo.
    expect(businessClock(new Date("2026-11-04T02:00:00Z"))).toEqual({
      date: "2026-11-03",
      minutes: 22 * 60
    });
  });

  it("is due from 00:05 DR time until it has run for that day", () => {
    expect(closeDue("2026-11-03", new Date("2026-11-04T04:03:00Z"))).toBeNull(); // 00:03
    expect(closeDue("2026-11-03", new Date("2026-11-04T04:05:00Z"))).toBe("2026-11-04"); // 00:05
    expect(closeDue("2026-11-04", new Date("2026-11-04T15:00:00Z"))).toBeNull();
  });

  it("catches up after downtime and runs the first time for a new business", () => {
    expect(closeDue("2026-10-30", new Date("2026-11-04T15:00:00Z"))).toBe("2026-11-04");
    expect(closeDue(null, new Date("2026-11-04T15:00:00Z"))).toBe("2026-11-04");
  });
});
