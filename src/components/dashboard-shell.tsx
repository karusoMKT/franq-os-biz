import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/hooks/use-profile";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  employee: "Funcionário",
};

export function DashboardShell({
  profile,
  title,
  subtitle,
  perms,
  children,
}: {
  profile: Profile;
  title: string;
  subtitle: string;
  perms: string[];
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">FranqOS</h1>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium">{profile.name ?? profile.email}</div>
              <Badge variant="secondary">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
            </div>
            <Button variant="outline" onClick={handleSignOut}>Sair</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-6 space-y-6">
        <section>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{subtitle}</p>
        </section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        {children}
      </main>
    </div>
  );
}
