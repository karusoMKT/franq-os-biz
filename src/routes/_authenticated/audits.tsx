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
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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

const CATEGORIES = [
  { key: "cleanliness", label: "Limpeza e Organização" },
  { key: "product_quality", label: "Qualidade do Produto" },
  { key: "service", label: "Atendimento" },
  { key: "visual_standard", label: "Padrão Visual" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];
type Scores = Record<CategoryKey, number>;

type Audit = {
  id: string;
  unit_id: string | null;
  audit_date: string | null;
  score: number;
  notes: string | null;
  categories: Record<string, number> | null;
  created_at: string | null;
};

type Unit = { id: string; name: string; city: string | null; state: string | null };

function scoreColor(s: number) {
  if (s >= 80) return "bg-green-500";
  if (s >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function AuditsPage() {
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState<Audit | null>(null);
  const [unitId, setUnitId] = useState<string>("");
  const [scores, setScores] = useState<Scores>({
    cleanliness: 7,
    product_quality: 7,
    service: 7,
    visual_standard: 7,
  });
  const [notes, setNotes] = useState("");

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
        .select("id,unit_id,audit_date,score,notes,categories,created_at")
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

  const finalScore = useMemo(() => {
    const vals = CATEGORIES.map((c) => scores[c.key]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(avg * 10);
  }, [scores]);

  const resetForm = () => {
    setUnitId("");
    setScores({ cleanliness: 7, product_quality: 7, service: 7, visual_standard: 7 });
    setNotes("");
  };

  const createAudit = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error("Selecione uma unidade");
      const { data: userData } = await supabase.auth.getUser();
      const categories: Record<string, number> = {};
      CATEGORIES.forEach((c) => (categories[c.key] = scores[c.key]));
      const { error } = await supabase.from("audits").insert({
        unit_id: unitId,
        auditor_id: userData.user?.id ?? null,
        audit_date: new Date().toISOString().slice(0, 10),
        score: finalScore,
        categories,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditoria salva com sucesso");
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-owner"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
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
    <MobileShell profile={profile} title="Auditorias" subtitle="Histórico e novas avaliações">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList size={16} /> {auditsQuery.data?.length ?? 0} registros
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-1" /> Nova
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
                    <div className="text-xs text-muted-foreground">
                      {a.audit_date ? new Date(a.audit_date).toLocaleDateString("pt-BR") : "-"}
                      {u?.city ? ` · ${u.city}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${scoreColor(a.score)} text-white border-0`}>
                      {a.score}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNotesOpen(a)}
                      disabled={!a.notes && !a.categories}
                    >
                      <FileText size={14} className="mr-1" /> Ver
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Audit dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Auditoria</DialogTitle>
            <DialogDescription>Avalie cada categoria de 0 a 10.</DialogDescription>
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
                      {u.name}{u.city ? ` — ${u.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {CATEGORIES.map((c) => (
              <div key={c.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{c.label}</Label>
                  <span className="text-sm font-semibold tabular-nums">{scores[c.key]}</span>
                </div>
                <Slider
                  value={[scores[c.key]]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setScores((s) => ({ ...s, [c.key]: v[0] }))}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label>Observações Gerais</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Pontos observados, recomendações, prazos..."
              />
            </div>

            <Card className="p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Score final</span>
              <Badge className={`${scoreColor(finalScore)} text-white border-0 text-base px-3 py-1`}>
                {finalScore} / 100
              </Badge>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createAudit.mutate()}
              disabled={!unitId || createAudit.isPending}
            >
              {createAudit.isPending ? "Salvando..." : "Salvar Auditoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes viewer */}
      <Dialog open={!!notesOpen} onOpenChange={(v) => !v && setNotesOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Auditoria</DialogTitle>
            <DialogDescription>
              {notesOpen?.unit_id ? unitsById.get(notesOpen.unit_id)?.name : ""}
              {notesOpen?.audit_date ? ` · ${new Date(notesOpen.audit_date).toLocaleDateString("pt-BR")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {notesOpen?.categories && (
              <div className="space-y-1.5">
                {CATEGORIES.map((c) => (
                  <div key={c.key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium tabular-nums">
                      {notesOpen.categories?.[c.key] ?? "-"}/10
                    </span>
                  </div>
                ))}
              </div>
            )}
            {notesOpen?.notes ? (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Observações</div>
                <div className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-muted/30">
                  {notesOpen.notes}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem observações registradas.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}
