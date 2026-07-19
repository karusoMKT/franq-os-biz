import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  AlertTriangle,
  Settings2,
  Trash2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Loading } from "@/components/loading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

type ResponseType = "boolean" | "money" | "freezer_grid";
type ChecklistItem = {
  id: string;
  question: string;
  required: boolean;
  response_type: ResponseType;
};
type Checklist = {
  id: string;
  title: string;
  category: string | null;
  is_critical: boolean;
  items: ChecklistItem[];
};
type AnswersData = Record<
  string,
  boolean | number | { count: number; temps: (string | number)[] } | null
>;
type Execution = {
  id: string;
  checklist_id: string;
  unit_id: string;
  user_id: string | null;
  status: "in_progress" | "completed";
  checked_items: Record<string, boolean>;
  answers_data: AnswersData;
  execution_date: string;
  completed_at: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const FRANCHISE_DEFAULTS: {
  title: string;
  category: string;
  is_critical?: boolean;
  items: { question: string; response_type: ResponseType }[];
}[] = [
  {
    title: "Abertura",
    category: "Operação",
    items: [
      { question: "Ligar PDVs", response_type: "boolean" },
      { question: "Abrir caixa e valor de abertura", response_type: "money" },
    ],
  },
  {
    title: "Cuidados com o freezer",
    category: "Qualidade",
    is_critical: true,
    items: [
      { question: "Conferir temperaturas", response_type: "freezer_grid" },
      { question: "Secagem dos freezers", response_type: "boolean" },
      { question: "Raspagem dos freezers", response_type: "boolean" },
    ],
  },
  {
    title: "Limpeza",
    category: "Higiene",
    items: [
      { question: "Limpeza de loja", response_type: "boolean" },
      { question: "Limpeza de PDVs", response_type: "boolean" },
      { question: "Limpeza de freezers", response_type: "boolean" },
      { question: "Limpeza e organização de estoque", response_type: "boolean" },
    ],
  },
  {
    title: "Recebimento de Mercadoria",
    category: "Estoque",
    items: [
      { question: "Conferência de notas", response_type: "boolean" },
      { question: "Organização de produtos em estoque", response_type: "boolean" },
      { question: "Abertura de produtos novos", response_type: "boolean" },
    ],
  },
  {
    title: "Fechamento",
    category: "Operação",
    items: [
      { question: "Fechar PDVs", response_type: "boolean" },
      { question: "Desligar luzes", response_type: "boolean" },
      { question: "Desligar computadores e eletrônicos", response_type: "boolean" },
    ],
  },
];

function isAnswered(item: ChecklistItem, answers: AnswersData, legacy: Record<string, boolean>) {
  const v = answers?.[item.id];
  if (item.response_type === "boolean") {
    if (typeof v === "boolean") return v;
    return !!legacy?.[item.id];
  }
  if (item.response_type === "money") {
    return typeof v === "number" && !Number.isNaN(v);
  }
  if (item.response_type === "freezer_grid") {
    if (!v || typeof v !== "object") return false;
    const grid = v as { count: number; temps: (string | number)[] };
    return (
      grid.count > 0 &&
      grid.temps.length === grid.count &&
      grid.temps.every((t) => t !== "" && t !== null && t !== undefined)
    );
  }
  return false;
}

function DailyChecklistsPage() {
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const { selectedUnitId, selectedUnit } = useUnitContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  const companyId = profile?.company_id ?? null;
  const unitId = profile?.role === "owner" ? selectedUnitId : profile?.unit_id ?? null;
  const canManage = profile?.role === "owner" || profile?.role === "manager";

  const checklistsKey = ["daily-checklists", companyId] as const;

  const { data: checklists, isLoading: loadingLists } = useQuery({
    enabled: !!companyId,
    queryKey: checklistsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("id,title,category,is_critical,checklist_items(id,question,required,response_type)")
        .order("is_critical", { ascending: false })
        .order("title");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        is_critical: c.is_critical,
        items: (c.checklist_items ?? []).map((it: any) => ({
          id: it.id,
          question: it.question,
          required: !!it.required,
          response_type: (it.response_type ?? "boolean") as ResponseType,
        })) as ChecklistItem[],
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
      return (data ?? []).map((e: any) => ({
        ...e,
        answers_data: (e.answers_data ?? {}) as AnswersData,
        checked_items: (e.checked_items ?? {}) as Record<string, boolean>,
      })) as Execution[];
    },
  });

  const startMutation = useMutation({
    mutationFn: async (checklist: Checklist) => {
      if (!unitId) throw new Error("Usuário sem unidade vinculada.");
      const existing = todaysExecs?.find(
        (e) => e.checklist_id === checklist.id && e.status === "in_progress",
      );
      if (existing) return existing;

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const { data, error } = await supabase
        .from("checklist_executions")
        .insert({
          checklist_id: checklist.id,
          unit_id: unitId,
          user_id: authData.user.id,
          status: "in_progress",
          checked_items: {},
          answers_data: {},
          execution_date: today(),
        } as any)
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

  const answerMutation = useMutation({
    mutationFn: async (args: {
      exec: Execution;
      itemId: string;
      value: AnswersData[string];
      alsoChecked?: boolean;
    }) => {
      const nextAnswers = { ...(args.exec.answers_data ?? {}), [args.itemId]: args.value };
      const patch: any = { answers_data: nextAnswers };
      if (typeof args.alsoChecked === "boolean") {
        patch.checked_items = {
          ...(args.exec.checked_items ?? {}),
          [args.itemId]: args.alsoChecked,
        };
      }
      const { data, error } = await supabase
        .from("checklist_executions")
        .update(patch)
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
        (old ?? []).map((e) => {
          if (e.id !== args.exec.id) return e;
          const nextChecked =
            typeof args.alsoChecked === "boolean"
              ? { ...(e.checked_items ?? {}), [args.itemId]: args.alsoChecked }
              : e.checked_items;
          return {
            ...e,
            answers_data: { ...(e.answers_data ?? {}), [args.itemId]: args.value },
            checked_items: nextChecked,
          };
        }),
      );
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["daily-executions", unitId, today()], ctx.prev);
      toast.error(e.message ?? "Erro ao salvar resposta");
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

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não encontrada");
      const existingTitles = new Set((checklists ?? []).map((c) => c.title.toLowerCase()));
      const toCreate = FRANCHISE_DEFAULTS.filter(
        (f) => !existingTitles.has(f.title.toLowerCase()),
      );
      if (!toCreate.length) return { created: 0 };

      const { data: created, error } = await supabase
        .from("checklists")
        .insert(
          toCreate.map((f) => ({
            company_id: companyId,
            title: f.title,
            category: f.category,
            is_critical: !!f.is_critical,
          })),
        )
        .select("id,title");
      if (error) throw error;

      const itemsPayload: any[] = [];
      (created ?? []).forEach((c: any) => {
        const def = toCreate.find((f) => f.title === c.title);
        def?.items.forEach((it) => {
          itemsPayload.push({
            checklist_id: c.id,
            question: it.question,
            required: false,
            response_type: it.response_type,
          });
        });
      });
      if (itemsPayload.length) {
        const { error: itemsErr } = await supabase.from("checklist_items").insert(itemsPayload);
        if (itemsErr) throw itemsErr;
      }
      return { created: toCreate.length };
    },
    onSuccess: (r) => {
      if (r.created === 0) toast.info("Padrões já estavam carregados.");
      else toast.success(`${r.created} rotina(s) padrão criada(s).`);
      queryClient.invalidateQueries({ queryKey: checklistsKey });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao carregar padrões"),
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
  const manageChecklist = manageId
    ? (checklists ?? []).find((c) => c.id === manageId) ?? null
    : null;

  if (loading || !profile) return <Loading />;

  if (!unitId) {
    return (
      <MobileShell profile={profile} title="Rotina Diária" subtitle="Checklists de hoje">
        <Card className="p-6 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="text-amber-500" />
          <div className="text-sm">
            {profile.role === "owner"
              ? "Selecione uma unidade específica no seletor de contexto (topo da tela) para visualizar e preencher os checklists do dia."
              : "Seu perfil ainda não está vinculado a uma unidade. Peça ao proprietário para associá-lo a uma unidade antes de preencher checklists."}
          </div>
        </Card>
      </MobileShell>
    );
  }

  if (activeExec && activeChecklist) {
    const locked = activeExec.status === "completed";
    const total = activeChecklist.items.length;
    const done = activeChecklist.items.filter((i) =>
      isAnswered(i, activeExec.answers_data, activeExec.checked_items),
    ).length;

    return (
      <MobileShell
        profile={profile}
        title={activeChecklist.title}
        subtitle={locked ? "Finalizado" : `${done}/${total} itens`}
      >
        <Button variant="ghost" size="sm" onClick={() => setActiveId(null)} className="gap-1 -ml-2">
          <ArrowLeft size={16} /> Voltar
        </Button>

        {activeChecklist.is_critical && (
          <Badge variant="destructive" className="w-fit">
            Checklist crítico
          </Badge>
        )}

        <Card className="p-3">
          {total === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Este modelo não possui itens cadastrados.
            </div>
          ) : (
            <ul className="divide-y">
              {activeChecklist.items.map((item) => (
                <li key={item.id} className="py-3">
                  <AnswerRow
                    item={item}
                    exec={activeExec}
                    locked={locked || answerMutation.isPending}
                    onAnswer={(value, alsoChecked) =>
                      answerMutation.mutate({ exec: activeExec, itemId: item.id, value, alsoChecked })
                    }
                  />
                </li>
              ))}
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

  const dateStr = today().split("-").reverse().join("/");
  const subtitle =
    selectedUnit && profile.role === "owner"
      ? `${selectedUnit.name} · ${dateStr}`
      : `Checklists de hoje · ${dateStr}`;

  return (
    <MobileShell profile={profile} title="Rotina Diária" subtitle={subtitle}>
      {canManage && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          disabled={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
        >
          <Sparkles size={14} />
          Carregar Padrões da Franquia
        </Button>
      )}

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
            const done = exec
              ? c.items.filter((i) => isAnswered(i, exec.answers_data, exec.checked_items)).length
              : 0;
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
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                          crítico
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.category ?? "Sem categoria"} ·{" "}
                      {exec ? `${done}/${total}` : `${total} ${total === 1 ? "item" : "itens"}`}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Gerenciar perguntas"
                      onClick={() => setManageId(c.id)}
                    >
                      <Settings2 size={16} />
                    </Button>
                  )}
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

      <ManageItemsDialog
        checklist={manageChecklist}
        open={!!manageChecklist}
        onOpenChange={(v) => !v && setManageId(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey: checklistsKey })}
      />
    </MobileShell>
  );
}

function AnswerRow({
  item,
  exec,
  locked,
  onAnswer,
}: {
  item: ChecklistItem;
  exec: Execution;
  locked: boolean;
  onAnswer: (value: AnswersData[string], alsoChecked?: boolean) => void;
}) {
  const current = exec.answers_data?.[item.id];

  if (item.response_type === "money") {
    const val = typeof current === "number" ? current : "";
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm">{item.question}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            disabled={locked}
            defaultValue={val}
            placeholder="0,00"
            onBlur={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isNaN(n)) return;
              if (n === current) return;
              onAnswer(n);
            }}
          />
        </div>
      </div>
    );
  }

  if (item.response_type === "freezer_grid") {
    const grid =
      current && typeof current === "object"
        ? (current as { count: number; temps: (string | number)[] })
        : { count: 0, temps: [] };
    const setCount = (n: number) => {
      const count = Math.max(0, Math.min(50, Math.floor(n) || 0));
      const temps = Array.from({ length: count }, (_, i) => grid.temps[i] ?? "");
      onAnswer({ count, temps });
    };
    const setTemp = (idx: number, v: string) => {
      const temps = [...grid.temps];
      temps[idx] = v;
      onAnswer({ count: grid.count, temps });
    };
    return (
      <div className="flex flex-col gap-2">
        <Label className="text-sm">{item.question}</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Qtd. freezers:</span>
          <Input
            type="number"
            min="0"
            max="50"
            className="w-20"
            disabled={locked}
            defaultValue={grid.count || ""}
            onBlur={(e) => setCount(parseInt(e.target.value, 10))}
          />
        </div>
        {grid.count > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: grid.count }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Freezer {i + 1}</span>
                <Input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="°C"
                  disabled={locked}
                  defaultValue={grid.temps[i] ?? ""}
                  onBlur={(e) => setTemp(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // boolean
  const checked =
    typeof current === "boolean" ? current : !!exec.checked_items?.[item.id];
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        checked={checked}
        disabled={locked}
        onCheckedChange={(v) => onAnswer(!!v, !!v)}
        className="mt-0.5"
      />
      <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>
        {item.question}
      </span>
    </div>
  );
}

function ManageItemsDialog({
  checklist,
  open,
  onOpenChange,
  onChanged,
}: {
  checklist: Checklist | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [newQuestion, setNewQuestion] = useState("");
  const [newType, setNewType] = useState<ResponseType>("boolean");

  const addMutation = useMutation({
    mutationFn: async (args: { question: string; response_type: ResponseType }) => {
      if (!checklist) throw new Error("Checklist inválido");
      const { error } = await supabase
        .from("checklist_items")
        .insert({
          checklist_id: checklist.id,
          question: args.question,
          required: false,
          response_type: args.response_type,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewQuestion("");
      setNewType("boolean");
      onChanged();
      toast.success("Pergunta adicionada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      onChanged();
      toast.success("Pergunta removida");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const submit = () => {
    const q = newQuestion.trim();
    if (!q) return;
    addMutation.mutate({ question: q, response_type: newType });
  };

  const typeLabel: Record<ResponseType, string> = {
    boolean: "Sim/Não",
    money: "Valor (R$)",
    freezer_grid: "Grade de freezers",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Gerenciar Perguntas{checklist ? ` — ${checklist.title}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nova pergunta..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={addMutation.isPending}
            />
            <Select value={newType} onValueChange={(v) => setNewType(v as ResponseType)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boolean">Sim/Não</SelectItem>
                <SelectItem value="money">Valor (R$)</SelectItem>
                <SelectItem value="freezer_grid">Grade freezers</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={submit} disabled={addMutation.isPending || !newQuestion.trim()}>
              <Plus size={16} className="mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="border rounded-md max-h-[50vh] overflow-y-auto">
            {!checklist?.items.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma pergunta cadastrada ainda.
              </div>
            ) : (
              <ul className="divide-y">
                {checklist.items.map((item, idx) => (
                  <li key={item.id} className="flex items-center gap-2 p-3">
                    <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{item.question}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {typeLabel[item.response_type]}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
