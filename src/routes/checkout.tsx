import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, CreditCard, Loader2, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  customerId: string;
  paymentId: string | null;
  invoiceUrl: string | null;
  qrCodeImage: string | null;
  payloadPix: string | null;
  pix: { payload: string; encodedImage: string } | null;
}

const onlyNumbers = (value: string) => value.replace(/\D/g, "");

function maskCpfCnpj(value: string): string {
  const digits = onlyNumbers(value);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string): string {
  const digits = onlyNumbers(value);
  if (digits.length > 11) return digits.slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function validateCheckout(form: { name: string; email: string; cpfCnpj: string; phone: string }) {
  const errors: string[] = [];
  const cleanCpfCnpj = onlyNumbers(form.cpfCnpj);
  const cleanPhone = onlyNumbers(form.phone);

  if (form.name.trim().length < 2) errors.push("Informe o nome completo.");
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.push("E-mail inválido.");
  if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
    errors.push("CPF deve ter 11 dígitos ou CNPJ 14 dígitos.");
  }
  if (form.phone.trim() && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
    errors.push("Telefone/WhatsApp inválido.");
  }
  return errors;
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

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubscribe = async () => {
    const errors = validateCheckout(form);
    if (errors.length > 0) {
      toast.error(errors[0]);
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
          cpfCnpj: onlyNumbers(form.cpfCnpj),
          email: form.email.trim(),
          phone: form.phone ? onlyNumbers(form.phone) : null,
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
    const payload = result?.payloadPix ?? result?.pix?.payload;
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    toast.success("Chave Pix copiada!");
  };

  const qrImage = result?.qrCodeImage ?? result?.pix?.encodedImage;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <FranqosLogo className="h-12 w-12 rounded-xl" />
          <h1 className="text-2xl font-bold tracking-tight">
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

        <Card>
          <CardHeader className="text-center pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Plano Completo
            </CardDescription>
            <CardTitle className="text-4xl font-bold flex items-end justify-center gap-1">
              <span>R$ 97</span>
              <span className="text-base font-normal text-muted-foreground pb-1">/mês</span>
            </CardTitle>
            <CardDescription>7 dias grátis. Cancele quando quiser.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-2">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {result ? (
              <div className="space-y-5 border-t pt-5">
                {billingType === "PIX" && qrImage ? (
                  <div className="space-y-4 text-center">
                    <p className="text-sm font-medium">Pague com Pix para ativar agora</p>
                    <img
                      src={qrImage.startsWith("data:image") ? qrImage : `data:image/png;base64,${qrImage}`}
                      alt="QR Code Pix da assinatura FranqOS"
                      className="mx-auto h-64 w-64 rounded-xl border bg-white p-3 object-contain"
                    />
                    <Button variant="outline" className="w-full" onClick={copyPix}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Chave Pix
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Assim que o Pix for pago, seu acesso será liberado automaticamente em alguns
                      segundos.
                    </p>
                  </div>
                ) : null}

                {billingType === "CREDIT_CARD" && result.invoiceUrl && (
                  <Button asChild className="w-full">
                    <a href={result.invoiceUrl} target="_blank" rel="noreferrer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pagar com cartão
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-5 border-t pt-5">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "PIX", label: "Pix", icon: QrCode },
                      { value: "CREDIT_CARD", label: "Cartão de Crédito", icon: CreditCard },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBillingType(opt.value)}
                      className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition ${
                        billingType === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <opt.icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      placeholder="Digite seu nome completo"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
                    <Input
                      id="cpfCnpj"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={form.cpfCnpj}
                      onChange={(e) => updateForm("cpfCnpj", maskCpfCnpj(e.target.value))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefone WhatsApp</Label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        inputMode="tel"
                        placeholder="(00) 00000-0000"
                        className="pl-9"
                        value={form.phone}
                        onChange={(e) => updateForm("phone", maskPhone(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubscribe}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>Pagar {PLAN_PRICE_LABEL}</>
                  )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
