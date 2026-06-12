import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/dashboard/manager")({
  head: () => ({ meta: [{ title: "Dashboard Gerente - FranqOS" }] }),
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && profile.role !== "manager") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  if (profile.role !== "manager") return null;

  return (
    <DashboardShell
      profile={profile}
      title="Dashboard Gerente"
      subtitle="Acompanhe checklists, equipe e indicadores da sua unidade."
      perms={["Checklists", "POPs", "Equipe", "Indicadores Operacionais"]}
    />
  );
}
