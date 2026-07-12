import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading";
import { Building2, TrendingUp, AlertTriangle, Target, MapPin, ShieldCheck, ClipboardCheck } from "lucide-react";
import { UnitsMap } from "@/components/units-map";
import { useUnitContext } from "@/hooks/use-unit-context";

export const Route = createFileRoute("/_authenticated/dashboard/owner")({
  head: () => ({ meta: [{ title: "Dashboard Proprietário - FranqOS" }] }),
  component: OwnerDashboard,
});

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
}

function OwnerDashboard() {
  const { profile, loading, error: profileError } = useProfile();
  const navigate = useNavigate();
  const { selectedUnitId, selectedUnit } = useUnitContext();

  useEffect(() => {
    if (loading || !profile) return;
    if (!profile.company_id) navigate({ to: "/onboarding", replace: true });
    else if (profile.role !== "owner") navigate({ to: "/dashboard", replace: true });
  }, [profile, loading, navigate]);

  const companyId = profile?.company_id ?? null;

  const { data, isLoading: dataLoading, isError: dataIsError, error } = useQuery({
    enabled: !!companyId,
    queryKey: ["owner-dashboard", companyId],
    queryFn: async () => {
      const [units, fin, scores, occ, notif] = await Promise.all([
        supabase.from("units").select("id,name,city,state,latitude,longitude,score,status").eq("company_id", companyId!),
        supabase.from("unit_financial_summary").select("*").eq("company_id", companyId!),
        supabase.from("operational_scores").select("unit_id,score,status"),
        supabase.from("occurrences").select("id,title,severity,status,created_at,unit_id").eq("company_id", companyId!).order("created_at", { ascending: false }).limit(20),
        supabase.from("notifications").select("id,is_read").eq("company_id", companyId!).eq("is_read", false),
      ]);
      const firstError = [units.error, fin.error, scores.error, occ.error, notif.error].find(Boolean);
      if (firstError) throw firstError;

      return {
        units: units.data ?? [],
        fin: fin.data ?? [],
        scores: scores.data ?? [],
        occurrences: occ.data ?? [],
        unread: notif.data?.length ?? 0,
      };
    },
  });

  // Recent audits for a specific unit
  const { data: unitAudits, isLoading: auditsLoading, isError: auditsIsError, error: auditsError } = useQuery({
    enabled: !!selectedUnitId,
    queryKey: ["unit-audits", selectedUnitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id,audit_date,score,notes,created_at")
        .eq("unit_id", selectedUnitId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pending daily checklists for a specific unit
  const today = new Date().toISOString().slice(0, 10);
  const { data: unitChecklists, isLoading: checklistsLoading, isError: checklistsIsError, error: checklistsError } = useQuery({
    enabled: !!selectedUnitId && !!companyId,
    queryKey: ["unit-daily-checklists", selectedUnitId, today],
    queryFn: async () => {
      const [tpl, exec] = await Promise.all([
        supabase.from("checklists").select("id,title,is_critical").eq("company_id", companyId!),
        supabase.from("checklist_executions").select("checklist_id,status").eq("unit_id", selectedUnitId!).eq("execution_date", today),
      ]);
      const firstError = [tpl.error, exec.error].find(Boolean);
      if (firstError) throw firstError;
      const done = new Set((exec.data ?? []).filter((e: any) => e.status === "completed").map((e: any) => e.checklist_id));
      const templates = tpl.data ?? [];
      return {
        total: templates.length,
        pending: templates.filter((t: any) => !done.has(t.id)),
      };
    },
  });

  if (profileError) {
    return <DashboardErrorCard title="Erro ao carregar perfil" message={profileError} />;
  }
  if (loading) {
    return <Loading />;
  }
  if (!profile) {
    return <DashboardErrorCard title="Perfil não encontrado" message="Seu usuário ainda não está vinculado a um perfil." />;
  }
  if (profile.role !== "owner") return null;

  if (dataIsError) {
    return (
      <MobileShell profile={profile} title="Dashboard" subtitle="Falha ao carregar dados">
        <DashboardErrorCard title="Erro ao carregar o Dashboard" message={error instanceof Error ? error.message : "Erro desconhecido."} />
      </MobileShell>
    );
  }

  const isOverview = !selectedUnitId;

  const totalRevenue = (data?.fin ?? []).reduce((s, r: any) => s + Number(r.total_revenue ?? 0), 0);
  const totalProfit = (data?.fin ?? []).reduce((s, r: any) => s + Number(r.net_profit ?? 0), 0);
  const avgScore = data?.scores.length
    ? (data.scores.reduce((s, r: any) => s + Number(r.score ?? 0), 0) / data.scores.length).toFixed(1)
    : "—";

  // Unit-specific data
  const unitScore = selectedUnitId
    ? data?.scores.find((s: any) => s.unit_id === selectedUnitId)
    : null;
  const unitFin = selectedUnitId
    ? (data?.fin ?? []).find((r: any) => r.unit_id === selectedUnitId)
    : null;
  const unitOccurrences = selectedUnitId
    ? (data?.occurrences ?? []).filter((o: any) => o.unit_id === selectedUnitId).slice(0, 5)
    : (data?.occurrences ?? []).slice(0, 5);

  return (
    <MobileShell
      profile={profile}
      title={isOverview ? `Olá, ${profile.name?.split(" ")[0] ?? "Proprietário"}` : selectedUnit?.name ?? "Unidade"}
      subtitle={isOverview ? "Visão geral da rede" : [selectedUnit?.city, selectedUnit?.state].filter(Boolean).join(" · ") || "Unidade selecionada"}
      unreadCount={data?.unread ?? 0}
    >
      {isOverview && (
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <MapPin size={16} className="text-[color:var(--franqos-blue)]" />
              Mapa da rede
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" />Saudável</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Atenção</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" />Crítico</span>
            </div>
          </div>
          {dataLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <UnitsMap units={(data?.units ?? []) as any} />
          )}
        </Card>
      )}

      {isOverview ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard loading={dataLoading} icon={<Building2 size={18} />} label="Unidades" value={String(data?.units.length ?? 0)} />
          <StatCard loading={dataLoading} icon={<Target size={18} />} label="Score médio" value={String(avgScore)} suffix="/10" />
          <StatCard loading={dataLoading} icon={<TrendingUp size={18} />} label="Faturamento" value={fmtBRL(totalRevenue)} />
          <StatCard loading={dataLoading} icon={<TrendingUp size={18} />} label="Lucro" value={fmtBRL(totalProfit)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard loading={dataLoading} icon={<Target size={18} />} label="Score" value={unitScore?.score != null ? String(unitScore.score) : "—"} suffix="/10" />
          <StatCard loading={checklistsLoading} icon={<ClipboardCheck size={18} />} label="Rotinas pendentes" value={unitChecklists ? String(unitChecklists.pending.length) : "—"} />
          <StatCard loading={dataLoading} icon={<TrendingUp size={18} />} label="Faturamento" value={fmtBRL(Number(unitFin?.total_revenue ?? 0))} />
          <StatCard loading={dataLoading} icon={<TrendingUp size={18} />} label="Lucro" value={fmtBRL(Number(unitFin?.net_profit ?? 0))} />
        </div>
      )}

      {isOverview && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Unidades</h3>
          {dataLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : data?.units.length ? (
            <ul className="space-y-2">
              {data.units.map((u: any) => {
                const score = data.scores.find((s: any) => s.unit_id === u.id);
                return (
                  <li key={u.id}>
                    <Card className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.city ?? "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[color:var(--franqos-blue)]">{score?.score ?? "—"}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">{score?.status ?? u.status}</div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState text="Nenhuma unidade cadastrada." />
          )}
        </section>
      )}

      {!isOverview && (
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <ClipboardCheck size={14} /> Rotinas pendentes hoje
          </h3>
          {checklistsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : checklistsIsError ? (
            <InlineError message={checklistsError instanceof Error ? checklistsError.message : "Erro ao carregar rotinas."} />
          ) : unitChecklists && unitChecklists.pending.length ? (
            <ul className="space-y-2">
              {unitChecklists.pending.map((c: any) => (
                <li key={c.id}>
                  <Card className="p-3 flex items-center justify-between">
                    <div className="text-sm font-medium">{c.title}</div>
                    {c.is_critical && (
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">crítico</span>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Todas as rotinas de hoje foram concluídas." />
          )}
        </section>
      )}

      {!isOverview && (
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <ShieldCheck size={14} /> Últimas auditorias
          </h3>
          {auditsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : auditsIsError ? (
            <InlineError message={auditsError instanceof Error ? auditsError.message : "Erro ao carregar auditorias."} />
          ) : unitAudits && unitAudits.length ? (
            <ul className="space-y-2">
              {unitAudits.map((a: any) => (
                <li key={a.id}>
                  <Card className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {a.audit_date ? new Date(a.audit_date).toLocaleDateString("pt-BR") : "Sem data"}
                      </div>
                      {a.notes && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{a.notes}</div>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--franqos-blue)]">
                      {Number(a.score).toFixed(0)}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Nenhuma auditoria registrada." />
          )}
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><AlertTriangle size={14} /> Ocorrências recentes</h3>
        {dataLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : unitOccurrences.length ? (
          <ul className="space-y-2">
            {unitOccurrences.map((o: any) => (
              <li key={o.id}>
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{o.title}</div>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{o.severity}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{o.status}</div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState text="Sem ocorrências." />
        )}
      </section>
    </MobileShell>
  );
}

function StatCard({ icon, label, value, suffix, loading }: { icon: React.ReactNode; label: string; value: string; suffix?: string; loading?: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      {loading ? (
        <Skeleton className="h-6 w-16 mt-1" />
      ) : (
        <div className="mt-1 text-lg font-bold">
          {value}
          {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
        </div>
      )}
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Card className="p-6 text-center text-sm text-muted-foreground">{text}</Card>;
}

function InlineError({ message }: { message: string }) {
  return <Card className="p-4 text-sm text-red-600">{message}</Card>;
}

function DashboardErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recarregar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
