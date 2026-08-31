import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "employee";

export interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  unit_id: string | null;
  name: string | null;
  email: string | null;
  role: AppRole;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
}

export const PROFILE_QUERY_KEY = ["profile"] as const;

async function fetchProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("[useProfile] getUser error:", userError);
  }

  const user = userData?.user ?? null;
  console.log("[useProfile/query] auth.user.id=", user?.id, "auth.user.email=", user?.email);

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[useProfile] select error:", error);
    throw error;
  }

  if (data) {
    console.log("[useProfile] profile.user_id=", data.user_id, "profile.email=", data.email);
    if (data.user_id !== user.id) {
      console.error("[useProfile] MISMATCH auth.uid vs profile.user_id — possível cache de sessão antiga");
    }
    return data as Profile;
  }

  console.warn("[useProfile] profile ausente, criando automaticamente para", user.id);
  const insertPayload = {
    user_id: user.id,
    name: (user.user_metadata?.name as string) ?? user.email,
    email: user.email,
    role: "owner" as const,
  };
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select()
    .maybeSingle();

  if (insertError) {
    console.error("[useProfile] insert error:", insertError);
    throw insertError;
  }

  if (created) {
    console.log("[useProfile] profile criado", created.user_id, created.email);
    return created as Profile;
  }

  return null;
}

export const profileQueryOptions = () =>
  queryOptions({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export function useProfile() {
  const query = useQuery(profileQueryOptions());

  return {
    profile: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
