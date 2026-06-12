import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Avisos - FranqOS" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { profile, loading } = useProfile();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    enabled: !!profile?.id,
    queryKey: ["notifications", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,message,is_read,created_at")
        .eq("profile_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <MobileShell profile={profile} title="Avisos" subtitle="Notificações recebidas">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id}>
              <Card className={`p-3 ${n.is_read ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                  </div>
                  {!n.is_read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Lido</Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum aviso.</Card>
      )}
    </MobileShell>
  );
}
