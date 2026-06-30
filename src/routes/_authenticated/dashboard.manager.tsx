import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loading } from "@/components/loading";
import { Target, ClipboardCheck, Users, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/manager")({
  head: () => ({ meta: [{ title: "Dashboard Gerente - FranqOS" }] }),
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;
    if (!profile.company_id) navigate({ to: "/onboarding", replace: true });
    else if (profile.role !== "manager") navigate({ to: "/dashboard", replace: true });
  }, [profile, loading, navigate]);

  const unitId = profile?.unit_id ?? null;
  const companyId = profile?.company_id ?? null;

  const { data, isLoading } = useQuery({
    enabled: !!unitId,
    queryKey: ["manager-dashboard", unitId],
    queryFn: async () => {
      const [unit, score, team, tasks, exec, notif] = await Promise.all([
        supabase.from("units").select("name,city").eq("id", unitId!).maybeSingle(),
        supabase.from("operational_scores").select("score,status").eq("unit_id", unitId!).maybeSingle(),
        supabase.from("profiles").select("id,name,role").eq("unit_id", unitId!),
        supabase.from("tasks").select("id,title,status,priority,due_date").eq("unit_id", unitId!).order("created_at", { ascending: false }).limit(5),
        supabase.from("checklist_executions").select("id,completed_at,score").eq("unit_id", unitId!).order("completed_at", { ascending: false }).limit(5),
        supabase.from("notifications").select("id").eq("unit_id", unitId!).eq("is_read", false),
      ]);
      return {
        unit: unit.data,
        score: score.data,
        team: team.data ?? [],
        tasks: tasks.data ?? [],
        executions: exec.data ?? [],
        unread: notif.data?.length ?? 0,
      };
    },
  });

  if (loading || !profile) return <Loading />;
  if (profile.role !== "manager") return null;

  if (!unitId) {
    return (
      <MobileShell profile={profile} title="Gerente" subtitle="Sem unidade vinculada">
        <Card className="p-6 text-sm text-muted-foreground">Seu perfil não está vinculado a uma unidade. Solicite ao proprietário.</Card>
      </MobileShell>
    );
  }

  void companyId;

  return (
    <MobileShell profile={profile} title={data?.unit?.name ?? "Unidade"} subtitle={data?.unit?.city ?? ""} unreadCount={data?.unread ?? 0}>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Target size={18} />} label="Score operacional" value={data?.score?.score?.toString() ?? "—"} suffix="/10" loading={isLoading} />
        <Stat icon={<ClipboardCheck size={18} />} label="Checklists feitos" value={String(data?.executions.length ?? 0)} loading={isLoading} />
        <Stat icon={<Users size={18} />} label="Equipe" value={String(data?.team.length ?? 0)} loading={isLoading} />
        <Stat icon={<ListTodo size={18} />} label="Tarefas" value={String(data?.tasks.length ?? 0)} loading={isLoading} />
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-2">Tarefas recentes</h3>
        {isLoading ? <Skeleton className="h-20 w-full" /> : data?.tasks.length ? (
          <ul className="space-y-2">
            {data.tasks.map((t: any) => (
              <li key={t.id}>
                <Card className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.due_date ?? "Sem prazo"}</div>
                  </div>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-100">{t.status}</span>
                </Card>
              </li>
            ))}
          </ul>
        ) : <Card className="p-6 text-center text-sm text-muted-foreground">Sem tarefas.</Card>}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Equipe</h3>
        {isLoading ? <Skeleton className="h-16 w-full" /> : data?.team.length ? (
          <ul className="space-y-2">
            {data.team.map((p: any) => (
              <li key={p.id}>
                <Card className="p-3 flex items-center justify-between">
                  <span className="text-sm">{p.name ?? "—"}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{p.role}</span>
                </Card>
              </li>
            ))}
          </ul>
        ) : <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum membro vinculado.</Card>}
      </section>
    </MobileShell>
  );
}

function Stat({ icon, label, value, suffix, loading }: { icon: React.ReactNode; label: string; value: string; suffix?: string; loading?: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      {loading ? <Skeleton className="h-6 w-16 mt-1" /> : (
        <div className="mt-1 text-lg font-bold">{value}{suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}</div>
      )}
    </Card>
  );
}
