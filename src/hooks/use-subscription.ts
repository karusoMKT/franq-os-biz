import { useQuery } from "@tanstack/react-query";
import { useProfile, type Profile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { computeSubscription, type CompanySubscription } from "@/lib/subscription";

export { computeSubscription } from "@/lib/subscription";

export const PLAN_PRICE_LABEL = "R$ 97/mês";

export interface SubscriptionState {
  loading: boolean;
  profile: Profile | null;
  company: CompanySubscription | null;
  status: string;
  isActive: boolean;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  daysLeft: number;
  hasAccess: boolean;
}

export function useSubscription(): SubscriptionState {
  const { profile, loading } = useProfile();
  const companyId = profile?.company_id;
  const query = useQuery({
    queryKey: ["company-subscription", companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<CompanySubscription | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase.from("companies")
        .select("id,subscription_status,trial_ends_at,plan").eq("id", companyId).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const company = query.data ?? null;
  return { loading: loading || (Boolean(companyId) && query.isPending), profile, company, ...computeSubscription(company) };
}
