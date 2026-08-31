import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useSubscription, PLAN_PRICE_LABEL } from "@/hooks/use-subscription";

export function TrialBanner() {
  const { isTrialing, daysLeft } = useSubscription();
  if (!isTrialing) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="mx-auto max-w-md px-4 py-2 flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] leading-tight text-amber-900 flex-1">
          Seu período de teste expira em <strong>{daysLeft}</strong>{" "}
          {daysLeft === 1 ? "dia" : "dias"}. Assine agora por {PLAN_PRICE_LABEL} para manter o
          acesso.
        </p>
        <Link
          to="/checkout"
          className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white"
        >
          Assinar
        </Link>
      </div>
    </div>
  );
}
