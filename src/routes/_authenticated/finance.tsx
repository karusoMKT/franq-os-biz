import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Wallet, Percent, Trash2, Repeat } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useUnitContext } from "@/hooks/use-unit-context";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loading } from "@/components/loading";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Financeiro - FranqOS" }] }),
  component: FinancePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-600">Erro: {error.message}</div>
  ),
});

type PeriodType = "daily" | "weekly" | "biweekly" | "monthly";

type Transaction = {
  id: string;
  unit_id: string | null;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string | null;
  description: string | null;
  created_at: string | null;
  period_type: PeriodType | null;
};

type RecurringExpense = {
  id: string;
  unit_id: string | null;
  category: string;
  amount: number;
  due_day: number;
  description: string | null;
  created_at: string | null;
};

const INCOME_CATEGORIES = ["Vendas", "Faturamento", "Serviços", "Outros"];
const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Folha de Pagamento",
  "Energia",
  "Água",
  "Internet",
  "Marketing",
  "Royalties",
  "Fundo de Propaganda",
  "Insumos",
  "Outros",
];

export function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/** Adjust date to the END of the selected period so charts anchor correctly. */
export function adjustDateToPeriodEnd(dateStr: string, period: PeriodType): string {
  if (period === "daily") return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  if (period === "weekly") {
    // end of week = Sunday (0). getUTCDay: 0..6 (Sun..Sat)
    const day = dt.getUTCDay();
    const diff = (7 - day) % 7;
    dt.setUTCDate(dt.getUTCDate() + diff);
  } else if (period === "biweekly") {
    dt.setUTCDate(dt.getUTCDate() + 13);
  } else if (period === "monthly") {
    dt.setUTCMonth(dt.getUTCMonth() + 1, 0); // last day of month
  }
  return dt.toISOString().slice(0, 10);
}

function isInCurrentMonth(dateStr: string | null) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === currentMonth();
}

function FinancePage() {
  const { profile, loading } = useProfile();
  const { selectedUnitId, selectedUnit, units } = useUnitContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const companyId = profile?.company_id ?? null;
  const isOverview = !selectedUnitId;

  const unitIds = useMemo(() => {
    if (selectedUnitId) return [selectedUnitId];
    return units.map((u) => u.id);
  }, [selectedUnitId, units]);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
  const [pendingDeleteRecurring, setPendingDeleteRecurring] = useState<RecurringExpense | null>(null);

  const txQuery = useQuery({
    enabled: !!companyId && unitIds.length > 0,
    queryKey: ["transactions", companyId, selectedUnitId ?? "all", unitIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("unit_id", unitIds)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const recurringQuery = useQuery({
    enabled: !!companyId && unitIds.length > 0,
    queryKey: ["recurring-expenses", companyId, selectedUnitId ?? "all", unitIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .select("*")
        .in("unit_id", unitIds)
        .order("due_day", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RecurringExpense[];
    },
  });

  const totals = useMemo(() => {
    const list = txQuery.data ?? [];
    const revenue = list.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expenseManual = list.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Recurring: sum current-month recurring expenses NOT already registered as tx this month.
    const monthExpenseCategories = new Set(
      list
        .filter((t) => t.type === "expense" && isInCurrentMonth(t.date))
        .map((t) => `${t.unit_id ?? ""}::${t.category}`),
    );
    const recurringMonth = (recurringQuery.data ?? [])
      .filter((r) => !monthExpenseCategories.has(`${r.unit_id ?? ""}::${r.category}`))
      .reduce((s, r) => s + Number(r.amount), 0);

    const expense = expenseManual + recurringMonth;
    const profit = revenue - expense;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, expense, profit, margin, recurringMonth };
  }, [txQuery.data, recurringQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído.");
      setPendingDeleteTx(null);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard-finance"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir."),
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gasto fixo excluído.");
      setPendingDeleteRecurring(null);
      queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard-finance"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir."),
  });

  if (loading) return <Loading />;
  if (!profile) return null;

  return (
    <MobileShell
      profile={profile}
      title="Financeiro"
      subtitle={isOverview ? "Visão geral da rede" : selectedUnit?.name ?? "Unidade"}
    >
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          loading={txQuery.isLoading}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          label="Faturamento"
          value={fmtBRL(totals.revenue)}
        />
        <StatCard
          loading={txQuery.isLoading}
          icon={<TrendingDown size={18} className="text-red-600" />}
          label="Despesas"
          value={fmtBRL(totals.expense)}
        />
        <StatCard
          loading={txQuery.isLoading}
          icon={<Wallet size={18} className="text-[color:var(--franqos-blue)]" />}
          label="Lucro"
          value={fmtBRL(totals.profit)}
        />
        <StatCard
          loading={txQuery.isLoading}
          icon={<Percent size={18} className="text-[color:var(--franqos-blue)]" />}
          label="Margem"
          value={`${totals.margin.toFixed(1)}%`}
        />
      </div>

      {totals.recurringMonth > 0 && (
        <div className="text-[11px] text-muted-foreground -mt-1">
          Inclui {fmtBRL(totals.recurringMonth)} de gastos fixos automáticos do mês.
        </div>
      )}

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
          <TabsTrigger value="recurring">Gastos Fixos</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lançamentos</h3>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={16} className="mr-1" /> Novo
            </Button>
          </div>

          {txQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : txQuery.isError ? (
            <Card className="p-4 text-sm text-red-600">
              {txQuery.error instanceof Error ? txQuery.error.message : "Erro ao carregar."}
            </Card>
          ) : (txQuery.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum lançamento registrado.
            </Card>
          ) : (
            <ul className="space-y-2">
              {(txQuery.data ?? []).map((t) => {
                const unitName = units.find((u) => u.id === t.unit_id)?.name;
                const periodLabel = t.period_type && t.period_type !== "daily"
                  ? t.period_type === "weekly" ? "Semanal"
                  : t.period_type === "biweekly" ? "Quinzenal"
                  : "Mensal"
                  : null;
                return (
                  <li key={t.id}>
                    <Card className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={t.type === "income" ? "default" : "secondary"} className="text-[10px]">
                            {t.type === "income" ? "Entrada" : "Saída"}
                          </Badge>
                          {periodLabel && (
                            <Badge variant="outline" className="text-[10px]">{periodLabel}</Badge>
                          )}
                          <span className="text-sm font-medium truncate">{t.category}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {t.date ? new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                          {isOverview && unitName ? ` · ${unitName}` : ""}
                          {t.description ? ` · ${t.description}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-sm font-semibold ${
                            t.type === "income" ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {t.type === "income" ? "+" : "-"}
                          {fmtBRL(Number(t.amount))}
                        </span>
                        <button
                          aria-label="Excluir"
                          className="text-muted-foreground hover:text-red-600 p-1"
                          onClick={() => {
                            setPendingDeleteTx(t);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="recurring" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <Repeat size={14} /> Gastos Fixos Recorrentes
            </h3>
            <Button size="sm" onClick={() => setRecurringOpen(true)}>
              <Plus size={16} className="mr-1" /> Novo
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Despesas cadastradas aqui são somadas automaticamente nas despesas do mês corrente.
          </p>

          {recurringQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : recurringQuery.isError ? (
            <Card className="p-4 text-sm text-red-600">
              {recurringQuery.error instanceof Error ? recurringQuery.error.message : "Erro ao carregar."}
            </Card>
          ) : (recurringQuery.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum gasto fixo cadastrado.
            </Card>
          ) : (
            <ul className="space-y-2">
              {(recurringQuery.data ?? []).map((r) => {
                const unitName = units.find((u) => u.id === r.unit_id)?.name;
                return (
                  <li key={r.id}>
                    <Card className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.category}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Todo dia {r.due_day}
                          {isOverview && unitName ? ` · ${unitName}` : ""}
                          {r.description ? ` · ${r.description}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-red-600">
                          {fmtBRL(Number(r.amount))}
                        </span>
                        <button
                          aria-label="Excluir"
                          className="text-muted-foreground hover:text-red-600 p-1"
                          onClick={() => {
                            setPendingDeleteRecurring(r);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <TransactionDialog
        open={open}
        onOpenChange={setOpen}
        units={units}
        forcedUnitId={selectedUnitId}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["owner-dashboard-finance"] });
        }}
      />

      <RecurringExpenseDialog
        open={recurringOpen}
        onOpenChange={setRecurringOpen}
        units={units}
        forcedUnitId={selectedUnitId}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
          queryClient.invalidateQueries({ queryKey: ["owner-dashboard-finance"] });
        }}
      />
    </MobileShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-20 mt-1" />
      ) : (
        <div className="mt-1 text-base font-bold">{value}</div>
      )}
    </Card>
  );
}

function TransactionDialog({
  open,
  onOpenChange,
  units,
  forcedUnitId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  units: { id: string; name: string }[];
  forcedUnitId: string | null;
  onSaved: () => void;
}) {
  const [unitId, setUnitId] = useState<string>("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [mode, setMode] = useState<"daily" | "period">("daily");
  const [period, setPeriod] = useState<Exclude<PeriodType, "daily">>("monthly");
  const [date, setDate] = useState<string>(today());
  const [month, setMonth] = useState<string>(currentMonth());
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const effectiveUnitId = forcedUnitId ?? unitId;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function submit() {
    if (!effectiveUnitId) return toast.error("Selecione a unidade.");
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) return toast.error("Informe um valor válido.");
    if (!category) return toast.error("Selecione a categoria.");

    const period_type: PeriodType = mode === "daily" ? "daily" : period;
    let refDate = date;
    if (mode === "period" && period === "monthly") {
      if (!month) return toast.error("Selecione o mês.");
      refDate = `${month}-01`;
    }
    if (!refDate) return toast.error("Informe a data.");
    const finalDate = adjustDateToPeriodEnd(refDate, period_type);

    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      unit_id: effectiveUnitId,
      type,
      category,
      amount: value,
      date: finalDate,
      description: description || null,
      period_type,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lançamento registrado.");
    setAmount("");
    setDescription("");
    setCategory("");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma entrada, saída ou período.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!forcedUnitId && (
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => { setType(v as any); setCategory(""); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Tipo de Lançamento</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "daily" | "period")}
              className="flex gap-3"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="daily" id="mode-daily" />
                Venda do Dia
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="period" id="mode-period" />
                Lançar Período
              </label>
            </RadioGroup>
          </div>

          {mode === "period" && (
            <div className="space-y-1">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{mode === "period" && period === "monthly" ? "Mês" : "Data"}</Label>
              {mode === "period" && period === "monthly" ? (
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              ) : (
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <Input
              placeholder="Observações"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecurringExpenseDialog({
  open,
  onOpenChange,
  units,
  forcedUnitId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  units: { id: string; name: string }[];
  forcedUnitId: string | null;
  onSaved: () => void;
}) {
  const [unitId, setUnitId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [dueDay, setDueDay] = useState<string>("5");
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const effectiveUnitId = forcedUnitId ?? unitId;

  async function submit() {
    if (!effectiveUnitId) return toast.error("Selecione a unidade.");
    if (!category) return toast.error("Selecione a categoria.");
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) return toast.error("Informe um valor válido.");
    const day = Number(dueDay);
    if (!day || day < 1 || day > 31) return toast.error("Dia de vencimento inválido (1-31).");

    setSaving(true);
    const { error } = await supabase.from("recurring_expenses").insert({
      unit_id: effectiveUnitId,
      category,
      amount: value,
      due_day: day,
      description: description || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Gasto fixo cadastrado.");
    setCategory("");
    setAmount("");
    setDescription("");
    setDueDay("5");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo gasto fixo</DialogTitle>
          <DialogDescription>Despesa recorrente somada automaticamente todo mês.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!forcedUnitId && (
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Dia do vencimento</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <Input
              placeholder="Ex: Aluguel da loja"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
