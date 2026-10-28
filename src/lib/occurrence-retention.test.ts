import { describe, expect, test } from "bun:test";
import { OCCURRENCE_RECENT_DAYS, occurrencesRecentCutoffIso } from "./occurrence-retention";

describe("recent occurrences window", () => {
  test("the cutoff is exactly the configured number of days back", () => {
    const now = new Date("2026-10-28T14:00:00.000Z");
    const cutoff = new Date(occurrencesRecentCutoffIso(now));
    expect(cutoff.getTime()).toBe(now.getTime() - OCCURRENCE_RECENT_DAYS * 24 * 60 * 60 * 1000);
  });
  test("an occurrence older than the window is before the cutoff", () => {
    const now = new Date("2026-10-28T14:00:00.000Z");
    const cutoff = occurrencesRecentCutoffIso(now);
    expect(new Date("2026-10-15T00:00:00.000Z").toISOString() < cutoff).toBe(true);
  });
});
