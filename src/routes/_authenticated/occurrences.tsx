import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Loading } from "@/components/loading";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/occurrences")({
  head: () => ({
    meta: [
      { title: "Ocorrências - FranqOS" },
      { name: "description", content: "Log de ocorrências operacionais da rede." },
    ],
  }),
  component: OccurrencesPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-600" role="alert">
      Erro ao carregar ocorrências: {error.message}
    </div>
  ),
});

type Occurrence = {
  id: string;
  unit_id: string | null;
  company_id: string;
  title: string;
  description: string | null;
  severity: string | null;
  status: string | null;
  routine_type: string | null;
  created_at: string | null;
};

function OccurrencesPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== "owner") navigate({ to: "/dashboard", replace: true });
  }, [profile, loading, navigate]);

  const companyId = profile?.company_id ?? null;

  const { data: units } = useQuery({
    enabled: !!companyId,
    queryKey: ["occ-units", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,name")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading, isError, error } = useQuery({
    enabled: !!companyId,
    queryKey: ["occurrences", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("id,unit_id,company_id,title,description,severity,status,routine_type,created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Occurrence[];
    },
  });

  if (loading) return <Loading />;
  if (!profile || profile.role !== "owner") return null;

  const unitName = (id: string | null) =>
    units?.find((u) => u.id === id)?.name ?? "Unidade";

  return (
    <MobileShell
      profile={profile}
      title="Ocorrências"
      subtitle="Log de eventos operacionais"
    >
      {isError ? (
        <Card className="p-4 text-sm text-red-600">
          {error instanceof Error ? error.message : "Erro ao carregar ocorrências."}
        </Card>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma ocorrência registrada.
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.map((o) => (
            <li key={o.id}>
              <Card className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <SeverityIcon severity={o.severity} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{o.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {unitName(o.unit_id)}
                        {o.created_at
                          ? ` · ${new Date(o.created_at).toLocaleString("pt-BR")}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <SeverityBadge severity={o.severity} />
                </div>
                {o.description && (
                  <p className="text-xs text-muted-foreground">{o.description}</p>
                )}
                <div className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                  {o.routine_type && <span>{o.routine_type}</span>}
                  {o.status && <span>· {o.status}</span>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </MobileShell>
  );
}

function SeverityIcon({ severity }: { severity: string | null }) {
  if (severity === "critical")
    return <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />;
  if (severity === "warning")
    return <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />;
  return <Info size={18} className="text-muted-foreground shrink-0 mt-0.5" />;
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (severity === "critical")
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Crítico</Badge>;
  if (severity === "warning")
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Atenção</Badge>;
  return <Badge variant="secondary">Info</Badge>;
}
