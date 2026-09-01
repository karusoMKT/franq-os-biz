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
  const isActive = status === "active";

  // Dias restantes calculados dinamicamente a partir da data fixa no banco
  const diffTime = trialEndsAt ? trialEndsAt.getTime() - Date.now() : 0;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  return {
    status,
    isActive,
    isTrialing: !isActive && daysRemaining > 0,
    trialEndsAt,
    daysLeft: daysRemaining,
    hasAccess: isActive || daysRemaining > 0,
  };
}


export function useSubscription(): SubscriptionState {
  const { profile, loading } = useProfile();
  return { loading, profile, ...computeSubscription(profile) };
}
