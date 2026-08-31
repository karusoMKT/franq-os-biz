import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/use-subscription";

/**
 * Guarda global: bloqueia a navegação no app quando o teste expirou
 * e a assinatura não está ativa.
 */
export function TrialGuard() {
  const { loading, profile, hasAccess } = useSubscription();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || !profile) return;
    if (hasAccess) return;
    if (pathname.startsWith("/checkout")) return;
    navigate({ to: "/checkout", replace: true });
  }, [loading, profile, hasAccess, pathname, navigate]);

  return null;
}
