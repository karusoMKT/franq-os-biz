import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/checklists")({
  head: () => ({ meta: [{ title: "Checklists - FranqOS" }] }),
  component: ChecklistsPage,
});

function ChecklistsPage() {
  const { profile, loading } = useProfile();
  const { data, isLoading } = useQuery({
    enabled: !!profile?.company_id,
    queryKey: ["checklists", profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("id,title,category,is_critical")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <MobileShell profile={profile} title="Checklists" subtitle="Procedimentos diários">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.id}>
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{c.title}</div>
                  {c.is_critical && <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">Crítico</span>}
                </div>
                <div className="text-xs text-muted-foreground">{c.category ?? "Geral"}</div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum checklist cadastrado.</Card>
      )}
    </MobileShell>
  );
}
