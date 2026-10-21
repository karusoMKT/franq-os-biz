export interface CompanySubscription {
  id: string;
  subscription_status: string;
  trial_ends_at: string | null;
  plan: string;
}

export function computeSubscription(company: CompanySubscription | null, now = Date.now()) {
  const status = company?.subscription_status ?? "unassigned";
  const isActive = status === "active" || status === "paid";
  const trialEndsAt = !isActive && company?.trial_ends_at ? new Date(company.trial_ends_at) : null;
  const remaining = trialEndsAt ? trialEndsAt.getTime() - now : 0;
  const daysLeft = Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining / 86_400_000)) : 0;
  const isTrialing = !isActive && ["trialing", "pending_payment"].includes(status) && daysLeft > 0;
  return { status, isActive, isTrialing, trialEndsAt, daysLeft, hasAccess: isActive || isTrialing };
}