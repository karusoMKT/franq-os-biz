import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/dashboard/employee")({
  head: () => ({ meta: [{ title: "Dashboard Funcionário - FranqOS" }] }),
  component: EmployeeDashboard,
});

function EmployeeDashboard() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && profile.role !== "employee") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  if (profile.role !== "employee") return null;

  return (
    <DashboardShell
      profile={profile}
      title="Dashboard Funcionário"
      subtitle="Execute checklists e consulte os procedimentos."
      perms={["Executar Checklists", "Visualizar POPs", "Avisos"]}
    />
  );
}
