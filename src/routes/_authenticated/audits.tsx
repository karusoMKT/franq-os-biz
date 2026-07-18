import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ClipboardList, FileText } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({ meta: [{ title: "Auditorias - FranqOS" }] }),
  component: AuditsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-600">Erro: {error.message}</div>
  ),
});

const QUESTIONS = [
  { key: "q1", label: "Freezers na temperatura e organização corretas?" },
  { key: "q2", label: "Fachada e calçada limpas?" },
  { key: "q3", label: "Uniforme dos atendentes completo?" },
  { key: "q4", label: "Estoque de casquinhas e embalagens organizado?" },
  { key: "q5", label: "Fechamento de caixa do dia anterior validado?" },
] as const;

type QKey = typeof QUESTIONS[number]["key"];
type Answers = Record<QKey, boolean>;

type Audit = {
  id: string;
  unit_id: string | null;
  auditor_name: string | null;
  audit_date: string | null;
  score: number;
  notes: string | null;
  categories: Record<string, unknown> | null;
  created_at: string | null;
};

type Unit = { id: string; name: string; city: string | null; state: string | null };

function scoreColor(s: number) {
  if (s >= 80) return "bg-green-500";
  if (s >= 50) return "bg-yellow-500";
  return "bg-red-500";
}
function scoreLabel(s: number) {
  if (s >= 80) return "Saudável";
  if (s >= 50) return "Atenção";
  return "Crítico";
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyAnswers = (): Answers => ({ q1: false, q2: false, q3: false, q4: false, q5: false });

function AuditsPage() {
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Audit | null>(null);

  const [unitId, setUnitId] = useState<string>("");
  const [auditorName, setAuditorName] = useState<string>("");
  const [auditDate, setAuditDate] = useState<string>(today());
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const [notes, setNotes] = useState<string>("");

  const companyId = profile?.company_id ?? null;

  const unitsQuery = useQuery({
    queryKey: ["units", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,name,city,state")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Unit[];
    },
  });

  const auditsQuery = useQuery({
    queryKey: ["audits", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id,unit_id,auditor_name,audit_date,score,notes,categories,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Audit[];
    },
  });

  const unitsById = useMemo(() => {
    const m = new Map<string, Unit>();
    (unitsQuery.data ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [unitsQuery.data]);

  const score = useMemo(
    () => QUESTIONS.reduce((sum, q) => sum + (answers[q.key] ? 20 : 0), 0),
    [answers],
  );

  const reset = () => {
    setUnitId("");
    setAuditorName(profile?.full_name ?? "");
    setAuditDate(today());
    setAnswers(emptyAnswers());
    setNotes("");
  };

  const createAudit = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error("Selecione uma unidade");
      if (!auditorName.trim()) throw new Error("Informe o nome do auditor");
      const { data: userData } = await supabase.auth.getUser();
      const categories: Record<string, boolean> = {};
      QUESTIONS.forEach((q) => (categories[q.key] = answers[q.key]));
      const payload = {
        unit_id: unitId,
        auditor_id: userData.user?.id ?? null,
        auditor_name: auditorName.trim(),
        audit_date: auditDate,
        score,
        categories,
        notes: notes.trim() || null,
      };
      const { error } = await supabase.from("audits").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditoria salva com sucesso");
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["company-units"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-owner"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao salvar"),
  });

  if (loading || !profile) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <MobileShell profile={profile} title="Auditorias" subtitle="Padrão e qualidade das unidades">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList size={16} /> {auditsQuery.data?.length ?? 0} registros
        </div>
        <Button
          size="sm"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus size={16} className="mr-1" /> Nova Auditoria
        </Button>
      </div>

      {auditsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (auditsQuery.data ?? []).length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma auditoria registrada ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {auditsQuery.data!.map((a) => {
            const u = a.unit_id ? unitsById.get(a.unit_id) : null;
            return (
              <Card key={a.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{u?.name ?? "Unidade removida"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.audit_date ? new Date(a.audit_date).toLocaleDateString("pt-BR") : "-"}
                      {a.auditor_name ? ` · ${a.auditor_name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`${scoreColor(a.score)} text-white border-0`}>
                      {a.score}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => setDetail(a)}>
                      <FileText size={14} className="mr-1" /> Ver
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Audit */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Auditoria</DialogTitle>
            <DialogDescription>Responda o checklist para calcular o score.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {(unitsQuery.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                      {u.city ? ` — ${u.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Auditor</Label>
                <Input
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  placeholder="Nome do auditor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Checklist</Label>
              <div className="space-y-2">
                {QUESTIONS.map((q) => (
                  <div
                    key={q.key}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <span className="text-sm pr-2">{q.label}</span>
                    <Switch
                      checked={answers[q.key]}
                      onCheckedChange={(v) =>
                        setAnswers((a) => ({ ...a, [q.key]: v }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Pontos observados, recomendações..."
              />
            </div>

            <Card className="p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Score final · {scoreLabel(score)}
              </span>
              <Badge
                className={`${scoreColor(score)} text-white border-0 text-base px-3 py-1`}
              >
                {score} / 100
              </Badge>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createAudit.mutate()}
              disabled={!unitId || !auditorName.trim() || createAudit.isPending}
            >
              {createAudit.isPending ? "Salvando..." : "Salvar Auditoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Auditoria</DialogTitle>
            <DialogDescription>
              {detail?.unit_id ? unitsById.get(detail.unit_id)?.name : ""}
              {detail?.audit_date
                ? ` · ${new Date(detail.audit_date).toLocaleDateString("pt-BR")}`
                : ""}
              {detail?.auditor_name ? ` · ${detail.auditor_name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {detail?.categories && (
              <div className="space-y-1.5">
                {QUESTIONS.map((q) => {
                  const val = (detail.categories as Record<string, unknown>)?.[q.key];
                  const yes = val === true || val === "true";
                  return (
                    <div key={q.key} className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">{q.label}</span>
                      <span
                        className={`font-medium shrink-0 ${
                          yes ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {yes ? "Sim" : "Não"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {detail?.notes ? (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Observações</div>
                <div className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-muted/30">
                  {detail.notes}
                </div>
              </div>
            ) : null}
            {detail && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <Badge
                  className={`${scoreColor(detail.score)} text-white border-0 text-base px-3 py-1`}
                >
                  {detail.score} / 100
                </Badge>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}
