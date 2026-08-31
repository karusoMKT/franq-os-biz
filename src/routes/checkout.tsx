import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FranqosLogo } from "@/components/franqos-logo";
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

function CheckoutPage() {
  const { isTrialing, daysLeft, hasAccess, isActive } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      toast.info("Pagamento ainda não configurado", {
        description: "Conecte o provedor de pagamento para liberar a assinatura.",
      });
    } finally {
      setLoading(false);
    }
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
              Acesso ilimitado a todas as ferramentas. Cancele quando quiser.
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

          <Button className="w-full" size="lg" onClick={handleSubscribe} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assinar por {PLAN_PRICE_LABEL}
          </Button>

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
