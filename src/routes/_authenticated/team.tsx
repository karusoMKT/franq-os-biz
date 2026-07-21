import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, LinkIcon, Users, Ticket } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Loading } from "@/components/loading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Equipe - FranqOS" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.role === "employee") {
      navigate({ to: "/daily-checklists", replace: true });
    }
  }, [profile, loading, navigate]);

  const canManage = profile?.role === "owner" || profile?.role === "manager";
  const isOwner = profile?.role === "owner";

  const { data: units = [] } = useQuery({
    enabled: !!profile?.company_id && canManage,
    queryKey: ["team-units", profile?.company_id, profile?.role, profile?.unit_id],
    queryFn: async () => {
      let q = supabase
        .from("units")
        .select("id,name,city,state")
        .eq("company_id", profile!.company_id!)
        .order("name");
      if (profile!.role === "manager" && profile!.unit_id) {
        q = q.eq("id", profile!.unit_id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    enabled: !!profile?.company_id && canManage,
    queryKey: ["team-members", profile?.company_id, profile?.role, profile?.unit_id],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("id,user_id,name,email,role,unit_id")
        .eq("company_id", profile!.company_id!)
        .order("name");
      if (profile!.role === "manager" && profile!.unit_id) {
        q = q.eq("unit_id", profile!.unit_id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Perfis criados via signup padrão que ainda não pertencem a nenhuma empresa
  const { data: unassigned = [], isLoading: unassignedLoading } = useQuery({
    enabled: !!profile && isOwner,
    queryKey: ["team-unassigned"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,user_id,name,email")
        .is("company_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    profile_id: "",
    role: "employee" as "manager" | "employee",
    unit_id: "",
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!form.profile_id) throw new Error("Selecione um usuário.");
      if (!form.unit_id) throw new Error("Selecione uma unidade.");
      const { error } = await supabase
        .from("profiles")
        .update({
          company_id: profile!.company_id!,
          unit_id: form.unit_id,
          role: form.role,
        })
        .eq("id", form.profile_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro vinculado com sucesso!");
      setOpen(false);
      setForm({ profile_id: "", role: "employee", unit_id: "" });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-unassigned"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao vincular membro."),
  });

  if (loading || !profile) return <Loading />;
  if (!canManage) {
    return (
      <MobileShell profile={profile} title="Equipe">
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </Card>
      </MobileShell>
    );
  }

  const unitName = (id: string | null) =>
    units.find((u) => u.id === id)?.name ?? "—";

  return (
    <MobileShell profile={profile} title="Equipe" subtitle="Gestão de acessos">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users size={18} /> Membros ({members.length})
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <LinkIcon size={16} className="mr-1" /> Vincular membro
          </Button>
        )}
      </div>

      {membersLoading ? (
        <Loading />
      ) : members.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum membro cadastrado.
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{m.name ?? m.email}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Unidade: {unitName(m.unit_id)}
                </div>
              </div>
              <Badge variant={m.role === "owner" ? "default" : "secondary"} className="capitalize">
                {m.role}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      {isOwner && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular membro</DialogTitle>
              <DialogDescription>
                Selecione um usuário que já criou conta no FranqOS e vincule-o a uma unidade.
                Peça ao colaborador para se cadastrar em <span className="font-medium">/signup</span> antes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Usuário disponível</Label>
                <Select
                  value={form.profile_id}
                  onValueChange={(v) => setForm({ ...form, profile_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        unassignedLoading
                          ? "Carregando..."
                          : unassigned.length === 0
                            ? "Nenhum usuário disponível"
                            : "Selecione..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {unassigned.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!unassignedLoading && unassigned.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Nenhum cadastro pendente. O colaborador precisa criar a conta primeiro.
                  </p>
                )}
              </div>

              <div>
                <Label>Cargo</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as "manager" | "employee" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Unidade</Label>
                <Select
                  value={form.unit_id}
                  onValueChange={(v) => setForm({ ...form, unit_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.city ? `— ${u.city}/${u.state}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => linkMutation.mutate()}
                disabled={
                  linkMutation.isPending ||
                  !form.profile_id ||
                  !form.unit_id
                }
              >
                {linkMutation.isPending ? "Vinculando..." : "Vincular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </MobileShell>
  );
}
