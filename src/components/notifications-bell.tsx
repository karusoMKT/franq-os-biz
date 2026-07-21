import { useMemo } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-profile";

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean | null;
  created_at: string | null;
  unit_id: string | null;
};

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("pt-BR");
}

export function NotificationsBell({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const companyId = profile.company_id;

  const { data, isLoading } = useQuery({
    enabled: !!companyId,
    queryKey: ["notifications-bell", companyId],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,message,is_read,created_at,unit_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    refetchInterval: 30_000,
  });

  const unread = useMemo(() => (data ?? []).filter((n) => !n.is_read), [data]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-bell"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!companyId || unread.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in(
          "id",
          unread.map((n) => n.id),
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-bell"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 text-muted-foreground"
          aria-label="Notificações"
        >
          <Bell size={20} />
          {unread.length > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">Notificações</div>
          {unread.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Carregando…
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação.
            </div>
          ) : (
            <ul className="divide-y">
              {data!.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2.5 ${n.is_read ? "opacity-60" : "bg-blue-50/40"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatWhen(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => markRead.mutate(n.id)}
                        disabled={markRead.isPending}
                      >
                        Lida
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
