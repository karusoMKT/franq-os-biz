import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/pops")({
  head: () => ({ meta: [{ title: "POPs - FranqOS" }] }),
  component: PopsPage,
});

type Pop = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  content: string | null;
  file_url: string | null;
};

function PopsPage() {
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Pop | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", category: "", content: "" });

  const queryKey = ["pops", profile?.company_id];

  const { data, isLoading } = useQuery({
    enabled: !!profile?.company_id,
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pops")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pop[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) => p.title.toLowerCase().includes(q));
  }, [data, search]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título é obrigatório");
      const payload = {
        title: form.title.trim(),
        category: form.category.trim() || null,
        content: form.content.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("pops").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pops").insert({
          ...payload,
          company_id: profile!.company_id!,
          created_by: profile!.user_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "POP atualizado" : "POP criado");
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("POP removido");
      queryClient.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", category: "", content: "" });
    setOpen(true);
  };

  const openEdit = (p: Pop) => {
    setEditing(p);
    setForm({
      title: p.title,
      category: p.category ?? "",
      content: p.content ?? p.description ?? "",
    });
    setOpen(true);
  };

  if (loading || !profile)
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <MobileShell profile={profile} title="POPs" subtitle="Procedimentos operacionais">
      <Button onClick={openNew} className="w-full">
        <Plus className="mr-2 h-4 w-4" /> Novo POP
      </Button>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtered.length > 0 ? (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Card
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => openEdit(p)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.category ?? "Geral"}
                    </div>
                    {(p.content || p.description) && (
                      <p className="text-xs mt-1 line-clamp-2 text-muted-foreground whitespace-pre-wrap">
                        {p.content ?? p.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(p.id);
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
          {search ? "Nenhum resultado." : "Nenhum POP cadastrado."}
        </Card>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar POP" : "Novo POP"}</DialogTitle>
            <DialogDescription>
              Procedimento operacional padrão da empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pop-title">Título</Label>
              <Input
                id="pop-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Abertura da loja"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pop-category">Categoria</Label>
              <Input
                id="pop-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Operação"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pop-content">Conteúdo</Label>
              <Textarea
                id="pop-content"
                rows={12}
                className="min-h-[240px] font-mono text-sm"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Passo a passo do procedimento..."
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
            <AlertDialogTitle>Excluir POP?</AlertDialogTitle>
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
