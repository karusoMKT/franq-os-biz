import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pops")({
  head: () => ({ meta: [{ title: "POPs - FranqOS" }] }),
  component: PopsPage,
});

function PopsPage() {
  const { profile, loading } = useProfile();
  const { data, isLoading } = useQuery({
    enabled: !!profile?.company_id,
    queryKey: ["pops", profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pops")
        .select("id,title,category,description,file_url")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <MobileShell profile={profile} title="POPs" subtitle="Procedimentos operacionais">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <Card className="p-3">
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.category ?? "Geral"}</div>
                {p.description && <p className="text-xs mt-1 line-clamp-2">{p.description}</p>}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum POP cadastrado.</Card>
      )}
    </MobileShell>
  );
}
