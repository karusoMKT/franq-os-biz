import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FranqosLockup } from "@/components/franqos-logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar - FranqOS" },
      { name: "description", content: "Acesse seu painel FranqOS" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      if (res.data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login realizado com sucesso!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const msg = /invalid login credentials|invalid_credentials/i.test(raw)
        ? "E-mail ou senha incorretos."
        : /email not confirmed/i.test(raw)
          ? "Confirme seu e-mail antes de entrar."
          : raw || "Erro ao entrar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(160deg, var(--franqos-navy) 0%, var(--franqos-navy-deep) 100%)",
      }}
    >
      <div className="w-full max-w-sm text-white">
        <div className="text-center mb-10 flex flex-col items-center">
          <FranqosLockup size="lg" />
          <p className="mt-6 text-base text-white/90">Bem-vindo de volta!</p>
          <p className="mt-1 text-sm text-white/60">
            Faça login para acessar seu painel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-white/80">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full h-11 rounded-lg bg-white/10 border border-white/15 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-white/80">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 rounded-lg bg-white/10 border border-white/15 px-3 pr-10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60"
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="pt-1">
              <Link to="/forgot-password" className="text-xs text-sky-300 hover:text-sky-200">
                Esqueci minha senha
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-center text-sm text-white/70 pt-2">
            Ainda não tem uma conta?{" "}
            <Link to="/signup" className="text-sky-300 font-medium hover:text-sky-200">
              Criar conta
            </Link>
          </div>

          <div className="text-center text-[11px] text-white/30 pt-4">v1.0.0</div>
        </form>
      </div>
    </div>
  );
}
