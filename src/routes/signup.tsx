import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Criar conta - FranqOS" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { name },
        },
      });
      if (error) throw error;
      // If email confirmation disabled, session is returned immediately.
      if (data.session) {
        navigate({ to: "/onboarding", search: { name } as never });
      } else {
        toast.success("Conta criada! Confirme seu e-mail para continuar.");
        navigate({ to: "/auth" });
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
        <p className="text-center text-sm text-slate-500 mt-2 mb-8">
          Preencha seus dados para começar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome completo">
            <input
              className={fieldCls}
              required
              placeholder="Ex: Reinaldo Santos"
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
