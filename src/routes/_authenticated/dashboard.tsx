import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - FranqOS" }] }),
  component: DashboardPage,
});

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  employee: "Funcionário",
};

const PERMISSIONS: Record<string, string[]> = {
  owner: ["Financeiro", "Unidades", "Metas", "Checklists", "POPs", "Relatórios"],
  manager: ["Checklists", "POPs", "Equipe", "Indicadores Operacionais"],
  employee: ["Executar Checklists", "Visualizar POPs", "Avisos"],
};

function DashboardPage() {
  const navigate = useNavigate();
  const { profile, loading, error } = useProfile();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Perfil não encontrado</CardTitle>
            <CardDescription>
              {error ?? "Seu usuário ainda não está vinculado a um perfil. Contate o administrador."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} variant="outline">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = profile.role;
  const perms = PERMISSIONS[role] ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">FranqOS</h1>
            <p className="text-sm text-muted-foreground">
              Dashboard {ROLE_LABELS[role] ?? role}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium">{profile.name ?? profile.email}</div>
              <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>
            </div>
            <Button variant="outline" onClick={handleSignOut}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {role === "owner" && <OwnerDashboard perms={perms} />}
        {role === "manager" && <ManagerDashboard perms={perms} />}
        {role === "employee" && <EmployeeDashboard perms={perms} />}
      </main>
    </div>
  );
}

function PermGrid({ perms }: { perms: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
      {perms.map((p) => (
        <Card key={p}>
          <CardHeader>
            <CardTitle className="text-base">{p}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Módulo disponível</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OwnerDashboard({ perms }: { perms: string[] }) {
  return (
    <section>
      <h2 className="text-2xl font-bold">Visão Geral - Proprietário</h2>
      <p className="text-muted-foreground">Acesso total à operação, financeiro e relatórios.</p>
      <PermGrid perms={perms} />
    </section>
  );
}

function ManagerDashboard({ perms }: { perms: string[] }) {
  return (
    <section>
      <h2 className="text-2xl font-bold">Gestão Operacional - Gerente</h2>
      <p className="text-muted-foreground">Acompanhe checklists, equipe e indicadores da sua unidade.</p>
      <PermGrid perms={perms} />
    </section>
  );
}

function EmployeeDashboard({ perms }: { perms: string[] }) {
  return (
    <section>
      <h2 className="text-2xl font-bold">Minha Operação - Funcionário</h2>
      <p className="text-muted-foreground">Execute checklists e consulte os procedimentos.</p>
      <PermGrid perms={perms} />
    </section>
  );
}
