import { useProfile, type Profile } from "@/hooks/use-profile";

export const PLAN_PRICE_LABEL = "R$ 97/mês";

export interface SubscriptionState {
  loading: boolean;
  profile: Profile | null;
  status: string;
  isActive: boolean;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  daysLeft: number;
  hasAccess: boolean;
}

export function computeSubscription(profile: Profile | null): Omit<SubscriptionState, "loading" | "profile"> {
  const status = profile?.subscription_status ?? "trialing";
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = Date.now();
  const isActive = status === "active";
  const trialValid = !!trialEndsAt && trialEndsAt.getTime() > now;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000))
    : 0;

  return {
    status,
    isActive,
    isTrialing: !isActive && trialValid,
    trialEndsAt,
    daysLeft,
    hasAccess: isActive || trialValid,
  };
}

export function useSubscription(): SubscriptionState {
  const { profile, loading } = useProfile();
  return { loading, profile, ...computeSubscription(profile) };
}
