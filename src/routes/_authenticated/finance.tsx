import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Wallet, Percent, Trash2, Repeat, Star, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
import { BillScannerButton } from "@/components/bill-scanner-dialog";

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

type AccountPayable = {
  id: string;
  company_id: string | null;
  unit_id: string | null;
  supplier_name: string;
  amount: number;
  due_date: string;
  status: string | null;
  created_at: string | null;
  receipt_url: string | null;
};

const INCOME_CATEGORIES = ["Vendas", "Faturamento", "Serviços", "Outros"];
const EXPENSE_CATEGORIES = [
  "Mercadoria",
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
const HIGHLIGHT_CATEGORIES = ["Mercadoria"];

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

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Próximos 2 meses + últimos 24, do mais recente ao mais antigo. */
function buildMonthOptions() {
  const now = new Date();
  const out: string[] = [];
  for (let i = -2; i <= 23; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}


function FinancePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const { selectedUnitId, selectedUnit, units } = useUnitContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.role !== "owner") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, loading, navigate]);

  const companyId = profile?.company_id ?? null;
  const isOverview = !selectedUnitId;

  const unitIds = useMemo(() => {
    if (selectedUnitId) return [selectedUnitId];
    return units.map((u) => u.id);
  }, [selectedUnitId, units]);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
  const [pendingDeleteRecurring, setPendingDeleteRecurring] = useState<RecurringExpense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  // Meses disponíveis: apenas os que possuem registros (transactions / accounts_payable) + mês atual
  const availableMonthsQuery = useQuery({
    enabled: !!companyId,
    queryKey: ["available-months", companyId, selectedUnitId ?? "all", unitIds.length],
    queryFn: async () => {
      const [tx, ap] = await Promise.all([
        unitIds.length > 0
          ? supabase.from("transactions").select("date").in("unit_id", unitIds).limit(5000)
          : Promise.resolve({ data: [], error: null } as any),
        (() => {
          let q = supabase.from("accounts_payable").select("due_date").eq("company_id", companyId!).limit(5000);
          if (selectedUnitId) q = q.or(`unit_id.eq.${selectedUnitId},unit_id.is.null`);
          return q;
        })(),
      ]);
      if (tx.error) throw tx.error;
      if (ap.error) throw ap.error;
      const set = new Set<string>();
      for (const r of (tx.data ?? []) as { date: string | null }[]) if (r.date) set.add(r.date.slice(0, 7));
      for (const r of (ap.data ?? []) as { due_date: string | null }[]) if (r.due_date) set.add(r.due_date.slice(0, 7));
      return Array.from(set);
    },
  });

  const monthOptions = useMemo(() => {
    const set = new Set<string>(availableMonthsQuery.data ?? []);
    set.add(currentMonth());
    set.add(selectedMonth);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [availableMonthsQuery.data, selectedMonth]);

  const range = useMemo(() => monthRange(selectedMonth), [selectedMonth]);

  const txQuery = useQuery({
    enabled: !!companyId && unitIds.length > 0,
    queryKey: ["transactions", companyId, selectedUnitId ?? "all", unitIds.length, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("unit_id", unitIds)
        .gte("date", range.start)
        .lte("date", range.end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const monthlyHistoryQuery = useQuery({
    enabled: !!companyId && unitIds.length > 0,
    queryKey: ["transactions-history", companyId, selectedUnitId ?? "all", unitIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount, date")
        .in("unit_id", unitIds)
        .order("date", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, { month: string; revenue: number; expense: number }>();
      for (const row of (data ?? []) as { type: string; amount: number; date: string | null }[]) {
        if (!row.date) continue;
        const m = row.date.slice(0, 7);
        const entry = map.get(m) ?? { month: m, revenue: 0, expense: 0 };
        if (row.type === "income") entry.revenue += Number(row.amount);
        else entry.expense += Number(row.amount);
        map.set(m, entry);
      }
      return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
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

  const accountsPayableQuery = useQuery({
    enabled: !!companyId,
    queryKey: ["accounts_payable", companyId, selectedUnitId ?? "all", unitIds.length, selectedMonth],
    queryFn: async () => {
      let q = supabase
        .from("accounts_payable")
        .select("*")
        .eq("company_id", companyId!)
        .gte("due_date", range.start)
        .lte("due_date", range.end);
      // Inclui contas sem unidade vinculada (ex.: escaneadas por owner sem unidade)
      if (selectedUnitId) {
        q = q.or(`unit_id.eq.${selectedUnitId},unit_id.is.null`);
      }
      const { data, error } = await q.order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AccountPayable[];
    },
  });


  const totals = useMemo(() => {
    const list = txQuery.data ?? [];
    const revenue = list.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expenseManual = list.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Gastos fixos do mês selecionado que ainda não têm lançamento equivalente.
    const monthExpenseCategories = new Set(
      list
        .filter((t) => t.type === "expense")
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
      queryClient.invalidateQueries({ queryKey: ["transactions-history"] });
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Período</span>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {monthOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
                {m === currentMonth() ? " (atual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BillScannerButton profile={profile} />

      <AccountsPayableSection
        query={accountsPayableQuery}
        units={units}
        isOverview={isOverview}
      />


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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
          <TabsTrigger value="recurring">Gastos Fixos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3 mt-3">
          <h3 className="text-sm font-semibold">Histórico Mensal</h3>
          {monthlyHistoryQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : monthlyHistoryQuery.isError ? (
            <Card className="p-4 text-sm text-red-600">Erro ao carregar histórico.</Card>
          ) : (monthlyHistoryQuery.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum histórico disponível.
            </Card>
          ) : (
            <ul className="space-y-2">
              {(monthlyHistoryQuery.data ?? []).map((m) => {
                const profit = m.revenue - m.expense;
                return (
                  <li key={m.month}>
                    <Card
                      className={cn(
                        "p-3 space-y-2 cursor-pointer",
                        m.month === selectedMonth && "ring-1 ring-[color:var(--franqos-blue)]",
                      )}
                      onClick={() => setSelectedMonth(m.month)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{monthLabel(m.month)}</span>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            profit >= 0
                              ? "bg-emerald-600 hover:bg-emerald-600"
                              : "bg-red-600 hover:bg-red-600",
                          )}
                        >
                          {profit >= 0 ? "Lucro" : "Prejuízo"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <div className="text-muted-foreground">Faturamento</div>
                          <div className="font-semibold text-emerald-600">{fmtBRL(m.revenue)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Despesas</div>
                          <div className="font-semibold text-red-600">{fmtBRL(m.expense)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Lucro líquido</div>
                          <div
                            className={cn(
                              "font-semibold",
                              profit >= 0 ? "text-emerald-600" : "text-red-600",
                            )}
                          >
                            {fmtBRL(profit)}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>


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
      queryClient.invalidateQueries({ queryKey: ["transactions-history"] });
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
      <AlertDialog
        open={!!pendingDeleteTx}
        onOpenChange={(v) => !v && setPendingDeleteTx(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDeleteTx) deleteMutation.mutate(pendingDeleteTx.id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDeleteRecurring}
        onOpenChange={(v) => !v && setPendingDeleteRecurring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gasto fixo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este gasto fixo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRecurringMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRecurringMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDeleteRecurring) deleteRecurringMutation.mutate(pendingDeleteRecurring.id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRecurringMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileShell>
  );
}

function AccountsPayableSection({
  query,
  units,
  isOverview,
}: {
  query: ReturnType<typeof useQuery<AccountPayable[]>>;
  units: { id: string; name: string }[];
  isOverview: boolean;
}) {
  const queryClient = useQueryClient();
  const rawList = query.data ?? [];

  const list = useMemo(() => {
    const arr = [...rawList];
    arr.sort((a, b) => {
      const aPaid = (a.status ?? "pending").toLowerCase() === "paid" ? 1 : 0;
      const bPaid = (b.status ?? "pending").toLowerCase() === "paid" ? 1 : 0;
      if (aPaid !== bPaid) return aPaid - bPaid;
      return (a.due_date ?? "").localeCompare(b.due_date ?? "");
    });
    return arr;
  }, [rawList]);

  const markPaidMutation = useMutation({
    mutationFn: async (item: AccountPayable) => {
      const { error } = await supabase
        .from("accounts_payable")
        .update({ status: "paid" })
        .eq("id", item.id);
      if (error) throw error;

      // Registra a baixa como despesa no fluxo de caixa
      const unitId = item.unit_id ?? units[0]?.id ?? null;
      if (unitId) {
        const { error: txError } = await supabase.from("transactions").insert({
          unit_id: unitId,
          type: "expense",
          category: "Contas a Pagar",
          amount: Number(item.amount),
          date: new Date().toISOString().slice(0, 10),
          description: `Baixa boleto: ${item.supplier_name}`,
        });
        if (txError) throw txError;
      }
    },
    onSuccess: () => {
      toast.success("Conta paga e lançada nas despesas.");
      queryClient.invalidateQueries({ queryKey: ["accounts_payable"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-history"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard-finance"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao dar baixa."),
  });


  return (
    <Card className="overflow-hidden">
      <div className="p-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">Contas a Pagar</h3>
        <p className="text-[11px] text-muted-foreground">
          Pendentes no topo, ordenadas por vencimento
        </p>
      </div>

      {query.isLoading ? (
        <div className="p-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : query.isError ? (
        <div className="p-4 text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : "Erro ao carregar contas a pagar."}
        </div>
      ) : list.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma conta a pagar encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Vencimento</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {isOverview && <TableHead className="hidden sm:table-cell">Unidade</TableHead>}
                <TableHead className="text-center w-[52px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => {
                const unitName = units.find((u) => u.id === item.unit_id)?.name ?? "—";
                const status = (item.status ?? "pending").toLowerCase();
                const isPaid = status === "paid";
                const isOverdue = !isPaid && item.due_date && new Date(item.due_date + "T00:00:00") < new Date();
                const isPending = markPaidMutation.isPending && markPaidMutation.variables?.id === item.id;
                return (
                  <TableRow key={item.id} className={cn(isPaid && "opacity-60")}>
                    <TableCell className={cn("font-medium text-sm truncate max-w-[140px]", isPaid && "line-through")}>
                      {item.supplier_name}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold", isPaid && "line-through")}>
                      {fmtBRL(Number(item.amount))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <span className={cn(isOverdue && "text-red-600 font-medium", isPaid && "line-through")}>
                        {new Date(item.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={isPaid ? "default" : "secondary"}
                        className={cn(
                          "text-[10px]",
                          isPaid && "bg-emerald-600 hover:bg-emerald-600",
                          !isPaid && isOverdue && "bg-red-100 text-red-700 hover:bg-red-100"
                        )}
                      >
                        {isPaid ? "Pago" : status === "pending" ? "Pendente" : item.status}
                      </Badge>
                    </TableCell>
                    {isOverview && (
                      <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground">
                        {unitName}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      {!isPaid && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          disabled={isPending}
                          onClick={() => markPaidMutation.mutate(item)}
                          title="Marcar como pago"
                        >
                          <Check size={16} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
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
  const [mode, setMode] = useState<"single" | "period">("single");
  const [singleDate, setSingleDate] = useState<string>(today());
  const [startDate, setStartDate] = useState<string>(today());
  const [endDate, setEndDate] = useState<string>(today());
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const effectiveUnitId = forcedUnitId ?? unitId;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function inferPeriodType(start: string | null, end: string): PeriodType {
    if (!start || start === end) return "daily";
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "daily";
    if (diffDays <= 7) return "weekly";
    if (diffDays <= 15) return "biweekly";
    return "monthly";
  }

  async function submit() {
    if (!effectiveUnitId) return toast.error("Selecione a unidade.");
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) return toast.error("Informe um valor válido.");
    if (!category) return toast.error("Selecione a categoria.");

    if (mode === "single" && !singleDate) return toast.error("Informe a data do lançamento.");
    if (mode === "period") {
      if (!endDate) return toast.error("Informe a data final.");
      if (startDate && startDate > endDate) return toast.error("Data inicial não pode ser após a final.");
    }

    const period_type: PeriodType =
      mode === "single" ? "daily" : inferPeriodType(startDate || null, endDate);

    const payload = {
      unit_id: effectiveUnitId,
      type,
      category,
      amount: value,
      date: mode === "single" ? singleDate : endDate,
      period_start: mode === "single" ? null : startDate || endDate,
      period_end: mode === "single" ? null : endDate,
      description: description || null,
      period_type,
    };

    setSaving(true);
    const { error } = await supabase.from("transactions").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lançamento registrado.");
    setAmount("");
    setDescription("");
    setCategory("");
    setMode("single");
    setSingleDate(today());
    setStartDate(today());
    setEndDate(today());
    onSaved();
    onOpenChange(false);
  }

  const periodLabel =
    mode === "single"
      ? "Dia único"
      : inferPeriodType(startDate || null, endDate) === "daily"
      ? "Dia único"
      : inferPeriodType(startDate || null, endDate) === "weekly"
      ? "Semanal"
      : inferPeriodType(startDate || null, endDate) === "biweekly"
      ? "Quinzenal"
      : "Mensal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Selecione o intervalo de datas do lançamento.</DialogDescription>
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
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {HIGHLIGHT_CATEGORIES.includes(c) && (
                      <span className="inline-flex items-center gap-1.5">
                        <Star size={12} className="text-amber-500 fill-amber-500" />
                        <span className="font-medium">{c}</span>
                        <span className="text-[10px] text-muted-foreground">(mais usado)</span>
                      </span>
                    )}
                    {!HIGHLIGHT_CATEGORIES.includes(c) && c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-1.5">
            <Label>Modelo de lançamento</Label>
            <div className="flex bg-muted rounded-lg p-1">
              <button
                type="button"
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md transition-all",
                  mode === "single" && "bg-background shadow-sm font-medium text-foreground"
                )}
                onClick={() => setMode("single")}
              >
                Lançamento Único
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md transition-all",
                  mode === "period" && "bg-background shadow-sm font-medium text-foreground"
                )}
                onClick={() => setMode("period")}
              >
                Lançamento por Período
              </button>
            </div>
          </div>

          {mode === "single" ? (
            <div className="space-y-1">
              <Label>Data do Lançamento</Label>
              <Input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data inicial</Label>
                  <Input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data final</Label>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground -mt-1">
                Período detectado: <span className="font-medium">{periodLabel}</span>
              </div>
            </>
          )}

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
