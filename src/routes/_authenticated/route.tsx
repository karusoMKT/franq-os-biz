import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { UnitContextProvider } from "@/hooks/use-unit-context";
import { PwaInstallModal } from "@/components/pwa-install-modal";
import { TrialGuard } from "@/components/trial-guard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <UnitContextProvider>
      <Outlet />
      <PwaInstallModal />
    </UnitContextProvider>
  ),
});
