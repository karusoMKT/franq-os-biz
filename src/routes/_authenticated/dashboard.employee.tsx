import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, BookOpen, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/employee")({
  head: () => ({ meta: [{ title: "Dashboard Funcionário - FranqOS" }] }),
  component: EmployeeDashboard,
});

function EmployeeDashboard() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && profile.role !== "employee") navigate({ to: "/dashboard", replace: true });
  }, [profile, loading, navigate]);

  const companyId = profile?.company_id ?? null;
  const profileId = profile?.id ?? null;
  const unitId = profile?.unit_id ?? null;

  const { data, isLoading } = useQuery({
    enabled: !!companyId,
    queryKey: ["employee-dashboard", profileId],
    queryFn: async () => {
      const [checklists, pops, tasks, notif] = await Promise.all([
        supabase.from("checklists").select("id,title,category").eq("company_id", companyId!).limit(10),
        supabase.from("pops").select("id,title,category").eq("company_id", companyId!).limit(10),
        supabase.from("tasks").select("id,title,status,due_date").eq("assigned_to", profileId!).order("due_date", { ascending: true }).limit(5),
        supabase.from("notifications").select("id,title,message,created_at").eq("profile_id", profileId!).eq("is_read", false).order("created_at", { ascending: false }).limit(5),
      ]);
      return {
        checklists: checklists.data ?? [],
        pops: pops.data ?? [],
        tasks: tasks.data ?? [],
        notifications: notif.data ?? [],
      };
    },
  });

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (profile.role !== "employee") return null;
  void unitId;

  return (
    <MobileShell profile={profile} title={`Olá, ${profile.name?.split(" ")[0] ?? "Funcionário"}`} subtitle="Suas tarefas de hoje" unreadCount={data?.notifications.length ?? 0}>
      <div className="grid grid-cols-3 gap-3">
        <QuickLink to="/checklists" icon={<ClipboardCheck size={20} />} label="Checklists" count={data?.checklists.length ?? 0} loading={isLoading} />
        <QuickLink to="/pops" icon={<BookOpen size={20} />} label="POPs" count={data?.pops.length ?? 0} loading={isLoading} />
        <QuickLink to="/notifications" icon={<Bell size={20} />} label="Avisos" count={data?.notifications.length ?? 0} loading={isLoading} />
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-2">Minhas tarefas</h3>
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
        ) : <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma tarefa pendente.</Card>}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Avisos</h3>
        {isLoading ? <Skeleton className="h-20 w-full" /> : data?.notifications.length ? (
          <ul className="space-y-2">
            {data.notifications.map((n: any) => (
              <li key={n.id}>
                <Card className="p-3">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.message}</div>
                </Card>
              </li>
            ))}
          </ul>
        ) : <Card className="p-6 text-center text-sm text-muted-foreground">Sem avisos novos.</Card>}
      </section>
    </MobileShell>
  );
}

function QuickLink({ to, icon, label, count, loading }: { to: string; icon: React.ReactNode; label: string; count: number; loading?: boolean }) {
  return (
    <Link to={to}>
      <Card className="p-3 flex flex-col items-center gap-1 hover:bg-accent transition">
        <div className="text-[color:var(--franqos-blue)]">{icon}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {loading ? <Skeleton className="h-5 w-6" /> : <div className="text-base font-bold">{count}</div>}
      </Card>
    </Link>
  );
}
