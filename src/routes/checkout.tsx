import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, CreditCard, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FranqosLogo } from "@/components/franqos-logo";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, PLAN_PRICE_LABEL } from "@/hooks/use-subscription";

export const Route = createFileRoute("/checkout")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assinar FranqOS | Plano Completo" },
      {
        name: "description",
        content:
          "Assine o FranqOS por R$ 97/mês e tenha acesso ilimitado a checklists, financeiro, auditorias e relatórios da sua franquia.",
      },
      { property: "og:title", content: "Assinar FranqOS | Plano Completo" },
      {
        property: "og:description",
        content: "Acesso ilimitado a todas as ferramentas do FranqOS por R$ 97/mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

const BENEFITS = [
  "Checklists e rotinas operacionais ilimitadas",
  "Módulo financeiro completo com contas a pagar",
  "Auditorias e score de saúde por unidade",
  "POPs, equipe e controle de acessos",
  "Notificações em tempo real e assistente no WhatsApp",
  "Unidades e usuários ilimitados",
];

type BillingType = "PIX" | "CREDIT_CARD";

interface SubscriptionResult {
  subscriptionId: string;
  invoiceUrl: string | null;
  pix: { payload: string; encodedImage: string } | null;
}

function CheckoutPage() {
  const { isTrialing, daysLeft, hasAccess, isActive, profile } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const [form, setForm] = useState({ name: "", cpfCnpj: "", email: "", phone: "" });

  useEffect(() => {
    if (!profile) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || (profile.name ?? ""),
      email: prev.email || (profile.email ?? ""),
    }));
  }, [profile]);

  const handleSubscribe = async () => {
    if (!form.name.trim() || form.cpfCnpj.replace(/\D/g, "").length < 11 || !form.email.trim()) {
      toast.error("Preencha nome, CPF/CNPJ e e-mail para continuar.");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Entre novamente.");
        return;
      }

      const res = await fetch("/api/public/asaas-create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
          email: form.email.trim(),
          phone: form.phone ? form.phone.replace(/\D/g, "") : null,
          billingType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao gerar assinatura");

      setResult(data as SubscriptionResult);
      toast.success("Assinatura gerada!", {
        description:
          billingType === "PIX"
            ? "Pague o Pix abaixo para liberar o acesso."
            : "Conclua o pagamento na página segura do cartão.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar assinatura");
    } finally {
      setLoading(false);
    }
  };

  const copyPix = async () => {
    if (!result?.pix) return;
    await navigator.clipboard.writeText(result.pix.payload);
    toast.success("Código Pix copiado!");
  };

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.01_240)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <FranqosLogo className="h-12 w-12 rounded-xl" />
          <h1 className="text-2xl font-bold">
            {isActive
              ? "Sua assinatura está ativa"
              : hasAccess
                ? "Garanta seu acesso contínuo"
                : "Seu período de teste terminou"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTrialing
              ? `Restam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} de teste gratuito.`
              : isActive
                ? "Você tem acesso ilimitado a todas as ferramentas."
                : "Assine para voltar a usar o FranqOS."}
          </p>
        </div>

        <Card className="p-6 space-y-5">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Plano Completo
            </div>
            <div className="mt-1 flex items-end justify-center gap-1">
              <span className="text-4xl font-bold">R$ 97</span>
              <span className="pb-1 text-sm text-muted-foreground">/mês</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              7 dias grátis. Cancele quando quiser.
            </p>
          </div>

          <ul className="space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {result ? (
            <div className="space-y-4 border-t pt-4">
              {result.pix ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm font-medium">Pague com Pix para ativar agora</p>
                  {result.pix.encodedImage && (
                    <img
                      src={
                        result.pix.encodedImage.startsWith("data:image/png;base64,")
                          ? result.pix.encodedImage
                          : `data:image/png;base64,${result.pix.encodedImage}`
                      }
                      alt="QR Code Pix da assinatura FranqOS"
                      className="mx-auto h-48 w-48 rounded-lg border bg-white p-2"
                    />
                  )}
                  <Button variant="outline" className="w-full" onClick={copyPix}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar código Pix
                  </Button>
                </div>
              ) : null}

              {result.invoiceUrl && (
                <Button asChild className="w-full">
                  <a href={result.invoiceUrl} target="_blank" rel="noreferrer">
                    Abrir fatura / pagar com cartão
                  </a>
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                O acesso é liberado automaticamente após a confirmação do pagamento.
              </p>
            </div>
          ) : (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "PIX", label: "Pix", icon: QrCode },
                    { value: "CREDIT_CARD", label: "Cartão", icon: CreditCard },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBillingType(opt.value)}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition ${
                      billingType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
                  <Input
                    id="cpfCnpj"
                    inputMode="numeric"
                    value={form.cpfCnpj}
                    onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Telefone (opcional)</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubscribe} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar assinatura · {PLAN_PRICE_LABEL}
              </Button>
            </div>
          )}

          {hasAccess && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              Voltar para o app
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
