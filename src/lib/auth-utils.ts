import { supabase } from "@/integrations/supabase/client";

/**
 * Encerra a sessão atual de forma completa:
 * - chama supabase.auth.signOut() (limpa session + localStorage)
 * - varre o localStorage por chaves residuais "sb-*" / "supabase.auth.*"
 * - garante que nenhum token antigo permaneça em cache
 */
export async function fullSignOut() {
  try {
    const { data: before } = await supabase.auth.getUser();
    console.log("[signOut] usuário atual antes do logout:", before.user?.id, before.user?.email);
  } catch (e) {
    console.warn("[signOut] getUser falhou:", e);
  }

  const { error } = await supabase.auth.signOut();
  if (error) console.error("[signOut] signOut error:", error);

  if (typeof window !== "undefined") {
    try {
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith("sb-") || k.startsWith("supabase.auth.")) {
          window.localStorage.removeItem(k);
        }
      }
    } catch (e) {
      console.warn("[signOut] limpeza de localStorage falhou:", e);
    }
  }

  const { data: after } = await supabase.auth.getUser();
  console.log("[signOut] usuário após logout (esperado null):", after.user?.id ?? null);
}
