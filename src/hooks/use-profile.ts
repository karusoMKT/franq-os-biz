import { useEffect, useState } from "react";
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
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (active) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) setError(error.message);
      setProfile(data as Profile | null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { profile, loading, error };
}
