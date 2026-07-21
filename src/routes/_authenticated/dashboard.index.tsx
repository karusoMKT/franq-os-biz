import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { fullSignOut } from "@/lib/auth-utils";
import { Loading } from "@/components/loading";
import { MobileShell } from "@/components/mobile-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, Briefcase } from "lucide-react";

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
      return;
    }
    if (profile.role === "owner") navigate({ to: "/dashboard/owner", replace: true });
    else if (profile.role === "manager") navigate({ to: "/dashboard/manager", replace: true });
    else if (profile.role === "employee") navigate({ to: "/daily-checklists", replace: true });
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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <MobileShell
      profile={profile}
      title={`${greeting}, ${firstName}! 👋`}
      subtitle={companyName}
    >
      <Card className="p-4 bg-gradient-to-br from-[color:var(--franqos-blue)] to-blue-600 text-white border-0">
        <div className="text-xs uppercase tracking-wide opacity-80">Empresa</div>
        <div className="text-lg font-bold">{companyName}</div>
        <div className="text-xs mt-1 opacity-90">
          Perfil: <strong className="capitalize">{profile.role}</strong>
        </div>
      </Card>

      <section>
        <h3 className="text-sm font-semibold mb-2">Acesso rápido</h3>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            icon={<LayoutDashboard size={20} />}
            label="Proprietário"
            onClick={() => navigate({ to: "/dashboard/owner" })}
          />
          <QuickAction
            icon={<Briefcase size={20} />}
            label="Gerente"
            onClick={() => navigate({ to: "/dashboard/manager" })}
          />
          <QuickAction
            icon={<Users size={20} />}
            label="Operacional"
            onClick={() => navigate({ to: "/dashboard/employee" })}
          />
        </div>
      </section>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Sessão</div>
            <div className="text-xs text-muted-foreground">{profile.email}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </Card>
    </MobileShell>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border bg-white p-3 flex flex-col items-center gap-1 hover:bg-accent transition text-center"
    >
      <div className="text-[color:var(--franqos-blue)]">{icon}</div>
      <div className="text-[11px] font-medium">{label}</div>
    </button>
  );
}
