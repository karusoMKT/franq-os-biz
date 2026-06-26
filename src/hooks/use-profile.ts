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

    const load = async (reason: string) => {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) console.error("[useProfile] getUser error:", uErr);
      const user = userData?.user ?? null;
      console.log(`[useProfile/${reason}] auth.user.id=`, user?.id, "auth.user.email=", user?.email);

      if (!active) return;
      if (!user) {
        setProfile(null);
        setLoading(false);
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
        console.log("[useProfile] profile.user_id=", data.user_id, "profile.email=", data.email);
        if (data.user_id !== user.id) {
          console.error("[useProfile] MISMATCH auth.uid vs profile.user_id — possível cache de sessão antiga");
        }
        setProfile(data as Profile);
        setLoading(false);
        return;
      }

      console.warn("[useProfile] profile ausente, criando automaticamente para", user.id);
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
      } else if (created) {
        console.log("[useProfile] profile criado", created.user_id, created.email);
        setProfile(created as Profile);
      }
      setLoading(false);
    };

    load("mount");

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[useProfile] onAuthStateChange:", event, "user=", session?.user?.id);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setLoading(true);
        setProfile(null);
        load(event);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  return { profile, loading, error };
}
