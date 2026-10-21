import { describe, expect, test } from "bun:test";
import { computeSubscription } from "./subscription";

const now = Date.parse("2026-10-21T23:00:00Z");
const company = { id: "company-a", subscription_status: "trialing", trial_ends_at: "2026-10-28T23:00:00Z", plan: "trial" };

describe("company entitlement", () => {
  test("active company grants every member access without a countdown, even after seven days", () => {
    const state = computeSubscription({ ...company, subscription_status: "active", trial_ends_at: "2026-10-01T00:00:00Z" }, now);
    expect(state.hasAccess).toBe(true);
    expect(state.isTrialing).toBe(false);
    expect(state.daysLeft).toBe(0);
    expect(state.trialEndsAt).toBeNull();
  });
  test("paid company also grants access without a countdown", () => {
    expect(computeSubscription({ ...company, subscription_status: "paid" }, now)).toMatchObject({ hasAccess: true, daysLeft: 0, isTrialing: false });
  });
  test("all invited members use the company deadline rather than a fresh seven-day trial", () => {
    expect(computeSubscription(company, now).daysLeft).toBe(7);
    expect(computeSubscription(company, now + 6 * 86_400_000).daysLeft).toBe(1);
    expect(computeSubscription(company, now + 7 * 86_400_000).hasAccess).toBe(false);
  });
  test("a user without a company does not obtain an individual trial", () => {
    expect(computeSubscription(null, now).hasAccess).toBe(false);
  });
  test("pending payment preserves only the existing company trial", () => {
    expect(computeSubscription({ ...company, subscription_status: "pending_payment" }, now + 7 * 86_400_000).hasAccess).toBe(false);
  });
});