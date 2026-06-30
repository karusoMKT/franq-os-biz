import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loading } from "@/components/loading";
import { Building2, TrendingUp, AlertTriangle, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/owner")({
  head: () => ({ meta: [{ title: "Dashboard Proprietário - FranqOS" }] }),
  component: OwnerDashboard,
});

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
}

function OwnerDashboard() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;
    if (!profile.company_id) navigate({ to: "/onboarding", replace: true });
    else if (profile.role !== "owner") navigate({ to: "/dashboard", replace: true });
  }, [profile, loading, navigate]);

  const companyId = profile?.company_id ?? null;

  const { data, isLoading: dataLoading, error } = useQuery({
    enabled: !!companyId,
    queryKey: ["owner-dashboard", companyId],
    queryFn: async () => {
      const [units, fin, scores, occ, notif] = await Promise.all([
        supabase.from("units").select("id,name,city,status").eq("company_id", companyId!),
        supabase.from("unit_financial_summary").select("*").eq("company_id", companyId!),
        supabase.from("operational_scores").select("unit_id,score,status"),
        supabase.from("occurrences").select("id,title,severity,status,created_at").eq("company_id", companyId!).order("created_at", { ascending: false }).limit(5),
        supabase.from("notifications").select("id,is_read").eq("company_id", companyId!).eq("is_read", false),
      ]);
      return {
        units: units.data ?? [],
        fin: fin.data ?? [],
        scores: scores.data ?? [],
        occurrences: occ.data ?? [],
        unread: notif.data?.length ?? 0,
      };
    },
  });

  if (loading || !profile) {
    return <Loading />;
  }
  if (profile.role !== "owner") return null;

  const totalRevenue = (data?.fin ?? []).reduce((s, r: any) => s + Number(r.total_revenue ?? 0), 0);
  const totalProfit = (data?.fin ?? []).reduce((s, r: any) => s + Number(r.net_profit ?? 0), 0);
  const avgScore = data?.scores.length
    ? (data.scores.reduce((s, r: any) => s + Number(r.score ?? 0), 0) / data.scores.length).toFixed(1)
    : "—";

  return (
    <MobileShell profile={profile} title={`Olá, ${profile.name?.split(" ")[0] ?? "Proprietário"}`} subtitle="Visão geral da rede" unreadCount={data?.unread ?? 0}>
      {error && <Card className="p-4 text-sm text-red-600">Erro ao carregar dados.</Card>}

      <div className="grid grid-cols-2 gap-3">
        <StatCard loading={dataLoading} icon={<Building2 size={18} />} label="Unidades" value={String(data?.units.length ?? 0)} />
        <StatCard loading={dataLoading} icon={<Target size={18} />} label="Score médio" value={String(avgScore)} suffix="/10" />
        <StatCard loading={dataLoading} icon={<TrendingUp size={18} />} label="Faturamento" value={fmtBRL(totalRevenue)} />
        <StatCard loading={dataLoading} icon={<TrendingUp size={18} />} label="Lucro" value={fmtBRL(totalProfit)} />
      </div>

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

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><AlertTriangle size={14} /> Ocorrências recentes</h3>
        {dataLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : data?.occurrences.length ? (
          <ul className="space-y-2">
            {data.occurrences.map((o: any) => (
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
