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
      const user = userData.user;
      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("[useProfile] select error:", error);
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile(data as Profile);
        setLoading(false);
        return;
      }

      // Profile não existe → cria automaticamente
      console.warn("[useProfile] profile ausente, criando automaticamente");
      const insertPayload = {
        user_id: user.id,
        name: (user.user_metadata?.name as string) ?? user.email,
        email: user.email,
        role: "owner" as const,
      };
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .insert(insertPayload)
        .select()
        .maybeSingle();
      if (!active) return;
      if (insErr) {
        console.error("[useProfile] insert error:", insErr);
        setError(insErr.message);
      } else {
        setProfile(created as Profile);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { profile, loading, error };
}
