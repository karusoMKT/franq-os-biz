import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/checklists")({
  head: () => ({ meta: [{ title: "Checklists - FranqOS" }] }),
  component: ChecklistsPage,
});

type Checklist = {
  id: string;
  title: string;
  category: string | null;
  is_critical: boolean;
};

function ChecklistsPage() {
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Checklist | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", category: "", is_critical: false });

  const queryKey = ["checklists", profile?.company_id];

  const { data, isLoading } = useQuery({
    enabled: !!profile?.company_id,
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Checklist[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título é obrigatório");
      if (editing) {
        const { error } = await supabase
          .from("checklists")
          .update({
            title: form.title.trim(),
            category: form.category.trim() || null,
            is_critical: form.is_critical,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("checklists").insert({
          company_id: profile!.company_id!,
          title: form.title.trim(),
          category: form.category.trim() || null,
          is_critical: form.is_critical,
          created_by: profile!.user_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Checklist atualizado" : "Checklist criado");
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist removido");
      queryClient.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", category: "", is_critical: false });
    setOpen(true);
  };

  const openEdit = (c: Checklist) => {
    setEditing(c);
    setForm({
      title: c.title,
      category: c.category ?? "",
      is_critical: c.is_critical,
    });
    setOpen(true);
  };

  if (loading || !profile)
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <MobileShell profile={profile} title="Checklists" subtitle="Procedimentos diários">
      <Button onClick={openNew} className="w-full">
        <Plus className="mr-2 h-4 w-4" /> Novo Checklist
      </Button>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.id}>
              <Card
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => openEdit(c)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{c.title}</div>
                      {c.is_critical && (
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Crítico
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.category ?? "Geral"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum checklist cadastrado.
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Checklist" : "Novo Checklist"}
            </DialogTitle>
            <DialogDescription>
              Rotina operacional a ser executada pela equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="chk-title">Título</Label>
              <Input
                id="chk-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Abertura"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="chk-category">Categoria</Label>
              <Input
                id="chk-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Operação"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="chk-critical">Crítico</Label>
                <p className="text-xs text-muted-foreground">
                  Impacta o score operacional.
                </p>
              </div>
              <Switch
                id="chk-critical"
                checked={form.is_critical}
                onCheckedChange={(v) => setForm({ ...form, is_critical: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileShell>
  );
}
