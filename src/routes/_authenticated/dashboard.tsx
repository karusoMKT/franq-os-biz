import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { fullSignOut } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - FranqOS" }] }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  const { profile, loading, error } = useProfile();

  useEffect(() => {
    if (loading || !profile) return;
    if (!profile.company_id) {
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (profile.role === "owner") navigate({ to: "/dashboard/owner", replace: true });
    else if (profile.role === "manager") navigate({ to: "/dashboard/manager", replace: true });
    else if (profile.role === "employee") navigate({ to: "/dashboard/employee", replace: true });
  }, [profile, loading, navigate]);

  const handleSignOut = async () => {
    await fullSignOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Erro ao carregar perfil</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
            <Button onClick={handleSignOut} variant="outline">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Perfil não encontrado</CardTitle>
            <CardDescription>
              Seu usuário ainda não está vinculado a um perfil. Contate o administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} variant="outline">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center">Redirecionando...</div>;
}
