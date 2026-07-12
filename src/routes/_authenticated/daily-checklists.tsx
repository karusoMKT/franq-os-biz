import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, CheckCircle2, Lock, ArrowLeft, AlertTriangle } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Loading } from "@/components/loading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUnitContext } from "@/hooks/use-unit-context";

export const Route = createFileRoute("/_authenticated/daily-checklists")({
  head: () => ({ meta: [{ title: "Rotina Diária - FranqOS" }] }),
  component: DailyChecklistsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-600" role="alert">
      Erro ao carregar rotina diária: {error.message}
    </div>
  ),
});

type ChecklistItem = { id: string; text: string };
type Checklist = {
  id: string;
  title: string;
  category: string | null;
  is_critical: boolean;
  items: ChecklistItem[];
};
type Execution = {
  id: string;
  checklist_id: string;
  unit_id: string;
  user_id: string | null;
  status: "in_progress" | "completed";
  checked_items: Record<string, boolean>;
  execution_date: string;
  completed_at: string | null;
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function normalizeItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (typeof it === "string") return { id: uid(), text: it };
      if (it && typeof it === "object") {
        const text = (it as any).text ?? (it as any).label ?? "";
        return { id: (it as any).id ?? uid(), text: String(text) };
      }
      return null;
    })
    .filter((x): x is ChecklistItem => !!x && x.text.trim() !== "");
}

const today = () => new Date().toISOString().slice(0, 10);

function DailyChecklistsPage() {
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const companyId = profile?.company_id ?? null;
  const unitId = profile?.unit_id ?? null;

  const { data: checklists, isLoading: loadingLists } = useQuery({
    enabled: !!companyId,
    queryKey: ["daily-checklists", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("id,title,category,is_critical,items")
        .order("is_critical", { ascending: false })
        .order("title");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        ...c,
        items: normalizeItems(c.items),
      })) as Checklist[];
    },
  });

  const { data: todaysExecs, isLoading: loadingExecs } = useQuery({
    enabled: !!unitId,
    queryKey: ["daily-executions", unitId, today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_executions")
        .select("*")
        .eq("unit_id", unitId!)
        .eq("execution_date", today());
      if (error) throw error;
      return (data ?? []) as Execution[];
    },
  });

  const startMutation = useMutation({
    mutationFn: async (checklist: Checklist) => {
      if (!unitId) throw new Error("Usuário sem unidade vinculada.");
      const existing = todaysExecs?.find(
        (e) => e.checklist_id === checklist.id && e.status === "in_progress",
      );
      if (existing) return existing;

      const { data, error } = await supabase
        .from("checklist_executions")
        .insert({
          checklist_id: checklist.id,
          unit_id: unitId,
          user_id: profile?.id ?? null,
          status: "in_progress",
          checked_items: {},
          execution_date: today(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as Execution;
    },
    onSuccess: (exec) => {
      queryClient.invalidateQueries({ queryKey: ["daily-executions", unitId, today()] });
      setActiveId(exec.id);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao iniciar checklist"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (args: { exec: Execution; itemId: string; checked: boolean }) => {
      const next = { ...(args.exec.checked_items ?? {}), [args.itemId]: args.checked };
      const { data, error } = await supabase
        .from("checklist_executions")
        .update({ checked_items: next })
        .eq("id", args.exec.id)
        .select()
        .single();
      if (error) throw error;
      return data as Execution;
    },
    onMutate: async (args) => {
      const key = ["daily-executions", unitId, today()];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Execution[]>(key);
      queryClient.setQueryData<Execution[]>(key, (old) =>
        (old ?? []).map((e) =>
          e.id === args.exec.id
            ? { ...e, checked_items: { ...(e.checked_items ?? {}), [args.itemId]: args.checked } }
            : e,
        ),
      );
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["daily-executions", unitId, today()], ctx.prev);
      toast.error(e.message ?? "Erro ao salvar item");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["daily-executions", unitId, today()] }),
  });

  const finishMutation = useMutation({
    mutationFn: async (exec: Execution) => {
      const { error } = await supabase
        .from("checklist_executions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", exec.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist finalizado!");
      queryClient.invalidateQueries({ queryKey: ["daily-executions", unitId, today()] });
      setActiveId(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  const execByChecklist = useMemo(() => {
    const map = new Map<string, Execution>();
    (todaysExecs ?? []).forEach((e) => {
      const cur = map.get(e.checklist_id);
      if (!cur || (cur.status === "completed" && e.status === "in_progress")) map.set(e.checklist_id, e);
    });
    return map;
  }, [todaysExecs]);

  const activeExec = activeId ? (todaysExecs ?? []).find((e) => e.id === activeId) ?? null : null;
  const activeChecklist = activeExec
    ? (checklists ?? []).find((c) => c.id === activeExec.checklist_id) ?? null
    : null;

  if (loading || !profile) return <Loading />;

  if (!unitId) {
    return (
      <MobileShell profile={profile} title="Rotina Diária" subtitle="Checklists de hoje">
        <Card className="p-6 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="text-amber-500" />
          <div className="text-sm">
            Seu perfil ainda não está vinculado a uma unidade. Peça ao proprietário para associá-lo a uma unidade antes de preencher checklists.
          </div>
        </Card>
      </MobileShell>
    );
  }

  if (activeExec && activeChecklist) {
    const locked = activeExec.status === "completed";
    const total = activeChecklist.items.length;
    const done = activeChecklist.items.filter((i) => activeExec.checked_items?.[i.id]).length;

    return (
      <MobileShell profile={profile} title={activeChecklist.title} subtitle={locked ? "Finalizado" : `${done}/${total} itens`}>
        <Button variant="ghost" size="sm" onClick={() => setActiveId(null)} className="gap-1 -ml-2">
          <ArrowLeft size={16} /> Voltar
        </Button>

        {activeChecklist.is_critical && (
          <Badge variant="destructive" className="w-fit">Checklist crítico</Badge>
        )}

        <Card className="p-3">
          {total === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Este modelo não possui itens cadastrados.
            </div>
          ) : (
            <ul className="divide-y">
              {activeChecklist.items.map((item) => {
                const checked = !!activeExec.checked_items?.[item.id];
                return (
                  <li key={item.id} className="flex items-start gap-3 py-3">
                    <Checkbox
                      checked={checked}
                      disabled={locked || toggleMutation.isPending}
                      onCheckedChange={(v) =>
                        toggleMutation.mutate({ exec: activeExec, itemId: item.id, checked: !!v })
                      }
                      className="mt-0.5"
                    />
                    <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>
                      {item.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {locked ? (
          <Card className="p-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border-green-200">
            <Lock size={16} /> Checklist finalizado. Não é mais editável.
          </Card>
        ) : (
          <Button
            className="w-full"
            size="lg"
            disabled={finishMutation.isPending || total === 0}
            onClick={() => finishMutation.mutate(activeExec)}
          >
            <CheckCircle2 size={18} className="mr-2" />
            Finalizar Checklist
          </Button>
        )}
      </MobileShell>
    );
  }

  return (
    <MobileShell profile={profile} title="Rotina Diária" subtitle={`Checklists de hoje · ${today().split("-").reverse().join("/")}`}>
      {loadingLists || loadingExecs ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !checklists?.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum modelo de checklist cadastrado ainda.
        </Card>
      ) : (
        <ul className="space-y-2">
          {checklists.map((c) => {
            const exec = execByChecklist.get(c.id);
            const total = c.items.length;
            const done = exec ? c.items.filter((i) => exec.checked_items?.[i.id]).length : 0;
            const completed = exec?.status === "completed";
            return (
              <li key={c.id}>
                <Card className="p-3 flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-md flex items-center justify-center ${
                      completed ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {completed ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      {c.is_critical && (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">crítico</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.category ?? "Sem categoria"} · {exec ? `${done}/${total}` : `${total} itens`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={completed ? "outline" : "default"}
                    disabled={startMutation.isPending}
                    onClick={() => {
                      if (exec) setActiveId(exec.id);
                      else startMutation.mutate(c);
                    }}
                  >
                    {completed ? "Ver" : exec ? "Continuar" : "Iniciar"}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </MobileShell>
  );
}
