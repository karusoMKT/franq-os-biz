import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Building2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PROFILE_QUERY_KEY } from "@/hooks/use-profile";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Criar conta - FranqOS" }] }),
  component: SignupPage,
});

type Mode = "owner" | "employee";

function SignupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("owner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const normalizedCode = inviteCode.trim().toUpperCase();

      // Validate invite code BEFORE creating the user, so a bad code doesn't
      // burn an email address.
      if (mode === "employee") {
        if (!normalizedCode) {
          toast.error("Informe o código de convite");
          setLoading(false);
          return;
        }
        const { data: valid, error: vErr } = await supabase.rpc(
          "invite_code_valid" as never,
          { _code: normalizedCode } as never,
        );
        if (vErr) throw vErr;
        if (!valid) {
          toast.error("Código de convite inválido");
          setLoading(false);
          return;
        }
      }

      const redirectPath = mode === "owner" ? "/onboarding" : "/daily-checklists";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectPath}`,
          data: { name },
        },
      });
      if (error) throw error;

      if (!data.session) {
        toast.success("Conta criada! Confirme seu e-mail para continuar.");
        navigate({ to: "/auth" });
        return;
      }

      if (mode === "employee") {
        const { error: rErr } = await supabase.rpc(
          "redeem_invite_code" as never,
          { _code: normalizedCode, _name: name } as never,
        );
        if (rErr) {
          toast.error(rErr.message ?? "Erro ao vincular ao código de convite");
          setLoading(false);
          return;
        }
        await qc.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        toast.success("Bem-vindo! Você foi vinculado à sua loja.");
        navigate({ to: "/daily-checklists" });
      } else {
        navigate({ to: "/onboarding", search: { name } as never });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-4 pt-6 pb-2 flex items-center">
        <Link to="/auth" className="p-2 -ml-2 text-slate-700">
          <ArrowLeft size={20} />
        </Link>
      </header>
      <div className="flex-1 px-6 pb-8 max-w-sm w-full mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 text-center">Criar sua conta</h1>
        <p className="text-center text-sm text-slate-500 mt-2 mb-6">
          Escolha o tipo de conta que você quer criar.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
          <TabBtn active={mode === "owner"} onClick={() => setMode("owner")}>
            <Building2 size={16} className="mr-1.5" /> Proprietário
          </TabBtn>
          <TabBtn active={mode === "employee"} onClick={() => setMode("employee")}>
            <KeyRound size={16} className="mr-1.5" /> Colaborador
          </TabBtn>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome completo">
            <input
              className={fieldCls}
              required
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="E-mail">
            <input
              className={fieldCls}
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha">
            <div className="relative">
              <input
                className={fieldCls + " pr-10"}
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar senha">
            <input
              className={fieldCls}
              type={showPwd ? "text" : "password"}
              required
              minLength={6}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {mode === "employee" && (
            <Field label="Código de convite">
              <input
                className={fieldCls + " uppercase tracking-widest font-mono"}
                required
                maxLength={8}
                placeholder="Ex: A3B7K9"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Peça o código para o proprietário ou gerente da sua loja.
              </p>
            </Field>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 rounded-lg bg-[var(--franqos-blue)] hover:opacity-90 text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Criando..." : "Continuar"}
          </button>

          <p className="text-center text-sm text-slate-500 pt-2">
            Já tem uma conta?{" "}
            <Link to="/auth" className="text-[var(--franqos-blue)] font-medium">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full h-11 rounded-lg bg-white border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--franqos-blue)]/40 focus:border-[var(--franqos-blue)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md text-sm font-medium flex items-center justify-center transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}
