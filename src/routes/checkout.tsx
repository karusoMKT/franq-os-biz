import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, CreditCard, Loader2, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FranqosLogo } from "@/components/franqos-logo";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, PLAN_PRICE_LABEL } from "@/hooks/use-subscription";

interface PixData {
  encodedImage: string;
  payload: string;
  txid?: string;
}

const withBase64Prefix = (image: string) =>
  image.startsWith("data:") ? image : `data:image/png;base64,${image}`;

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

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().email("E-mail inválido."),
  cpfCnpj: z
    .string()
    .trim()
    .refine(
      (val) => {
        const digits = onlyNumbers(val);
        return digits.length === 11 || digits.length === 14;
      },
      { message: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos." },
    ),
  phone: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true;
        const digits = onlyNumbers(val);
        return digits.length >= 10 && digits.length <= 11;
      },
      { message: "Telefone/WhatsApp inválido." },
    ),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function CheckoutPage() {
  const { isTrialing, daysLeft, hasAccess, isActive, profile } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [pixData, setPixData] = useState<PixData | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: "", email: "", cpfCnpj: "", phone: "" },
  });

  useEffect(() => {
    if (!profile) return;
    if (profile.name) setValue("name", profile.name);
    if (profile.email) setValue("email", profile.email);
  }, [profile, setValue]);

  const copyPix = async () => {
    if (!pixData) return;
    try {
      await navigator.clipboard.writeText(pixData.payload);
      toast.success("Código Pix copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  const onSubmit = async (form: CheckoutForm) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/public/efi-create-charge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          cpfCnpj: onlyNumbers(form.cpfCnpj),
          phone: onlyNumbers(form.phone),
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Resposta inesperada do servidor. Tente novamente em instantes.");
      }

      const data = await res.json();
      if (!res.ok || !data?.success || !data?.pix?.encodedImage || !data?.pix?.payload) {
        throw new Error(data?.error ?? "Não foi possível gerar o Pix. Tente novamente.");
      }

      setPixData(data.pix as PixData);
      toast.success("Pix gerado!", {
        description: "Escaneie o QR Code ou copie o código para pagar.",
      });
    } catch (err) {
      console.error("[checkout] erro ao gerar Pix:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setLoading(false);
    }
  };

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
            {pixData ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code abaixo no app do seu banco para pagar {PLAN_PRICE_LABEL}.
                </p>
                <img
                  src={withBase64Prefix(pixData.encodedImage)}
                  alt="QR Code Pix"
                  className="w-56 h-56 mx-auto my-4 rounded-lg border p-2"
                />
                <div className="space-y-2 text-left">
                  <Label htmlFor="pix-payload">Pix Copia e Cola</Label>
                  <Input id="pix-payload" readOnly value={pixData.payload} className="text-xs" />
                  <Button type="button" className="w-full" onClick={copyPix}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Código Pix
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Após o pagamento, seu acesso é liberado automaticamente.
                </p>
                <Button variant="ghost" className="w-full" onClick={() => setPixData(null)}>
                  Voltar
                </Button>
              </div>
            ) : (
              <>
            <ul className="space-y-2">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5 border-t pt-5">
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
                    autoComplete="name"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
                  <Controller
                    name="cpfCnpj"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="cpfCnpj"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="000.000.000-00"
                        value={field.value}
                        onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                      />
                    )}
                  />
                  {errors.cpfCnpj && (
                    <p className="text-xs text-destructive">{errors.cpfCnpj.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone WhatsApp</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="phone"
                          type="text"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="(00) 00000-0000"
                          className="pl-9"
                          value={field.value}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                      )}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <Button className="w-full" size="lg" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando Pix...
                  </>
                ) : (
                  <>Pagar {PLAN_PRICE_LABEL}</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                O pagamento é feito por Pix. Assim que for confirmado, seu acesso é liberado
                automaticamente.
              </p>
            </form>
              </>
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
