import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { createTeamMember } from "@/lib/api/team.functions";
import { MobileShell } from "@/components/mobile-shell";
import { Loading } from "@/components/loading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const createFn = useServerFn(createTeamMember);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.role === "employee") {
      navigate({ to: "/daily-checklists", replace: true });
    }
  }, [profile, loading, navigate]);

  const canManage = profile?.role === "owner" || profile?.role === "manager";

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

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee" as "manager" | "employee",
    unit_id: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.unit_id) throw new Error("Selecione uma unidade.");
      return await createFn({ data: form });
    },
    onSuccess: () => {
      toast.success("Membro criado com sucesso!");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "employee", unit_id: "" });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao criar membro."),
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
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus size={16} className="mr-1" /> Novo membro
        </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo membro</DialogTitle>
            <DialogDescription>
              Crie uma conta de gerente ou funcionário vinculada a uma unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
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
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !form.name ||
                !form.email ||
                form.password.length < 6 ||
                !form.unit_id
              }
            >
              {createMutation.isPending ? "Criando..." : "Criar membro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}
