import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-profile";
import { fullSignOut } from "@/lib/auth-utils";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PushOptIn } from "@/components/push-opt-in";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  employee: "Funcionário",
};

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil - FranqOS" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  const signOut = async () => {
    await fullSignOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <MobileShell profile={profile} title="Perfil" subtitle="Sua conta">
      <Card className="p-4 space-y-2">
        <div className="text-base font-semibold">{profile.name ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{profile.email}</div>
        <Badge variant="secondary">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
      </Card>
      <PushOptIn userId={profile.user_id} companyId={profile.company_id ?? null} />
      <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
    </MobileShell>
  );
}
