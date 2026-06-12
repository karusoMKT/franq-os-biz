import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/dashboard/owner")({
  head: () => ({ meta: [{ title: "Dashboard Proprietário - FranqOS" }] }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && profile.role !== "owner") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  if (profile.role !== "owner") return null;

  return (
    <DashboardShell
      profile={profile}
      title="Dashboard Proprietário"
      subtitle="Acesso total à operação, financeiro e relatórios."
      perms={["Financeiro", "Unidades", "Metas", "Checklists", "POPs", "Relatórios"]}
    />
  );
}
