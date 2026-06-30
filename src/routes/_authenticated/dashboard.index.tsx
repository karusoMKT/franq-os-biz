import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { fullSignOut } from "@/lib/auth-utils";
import { Loading } from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard FranqOS" }] }),
  component: DashboardHome,
  errorComponent: DashboardError,
});

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Erro no Dashboard</CardTitle>
          <CardDescription>{error?.message ?? "Falha desconhecida ao renderizar."}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button onClick={() => window.location.reload()} variant="outline">Recarregar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardHome() {
  const { profile, loading, error } = useProfile();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (loading || !profile) return;
    if (!profile.company_id) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [profile, loading, navigate]);

  const { data: company } = useQuery({
    enabled: !!profile?.company_id,
    queryKey: ["company", profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name")
        .eq("id", profile!.company_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fullSignOut();
      navigate({ to: "/auth", replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) return <Loading />;

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
            <Button onClick={handleSignOut} variant="outline" disabled={signingOut}>Sair</Button>
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
            <CardDescription>Seu usuário ainda não está vinculado a um perfil.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} variant="outline" disabled={signingOut}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = profile.name?.split(" ")[0] ?? "usuário";
  const companyName = company?.name ?? "sua empresa";

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard FranqOS</h1>
        <Button onClick={handleSignOut} variant="outline" size="sm" disabled={signingOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo, {firstName}!</CardTitle>
          <CardDescription>
            Você está conectado a <strong>{companyName}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Perfil: <strong>{profile.role}</strong></p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => navigate({ to: "/dashboard/owner" })}>Visão proprietário</Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dashboard/manager" })}>Visão gerente</Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dashboard/employee" })}>Visão operacional</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
