import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enablePush, isPushActive } from "@/lib/push";

export function PushOptIn({ userId, companyId }: { userId: string; companyId: string | null }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void isPushActive().then(setActive); }, []);

  async function activate() {
    setBusy(true);
    try {
      await enablePush(userId, companyId);
      setActive(true);
      toast.success("Notificações ativadas neste aparelho!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar as notificações.");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        {active ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Notificações no celular</div>
        <div className="text-xs text-muted-foreground">
          {active ? "Ativas neste aparelho." : "Receba alertas de vencimentos e confirmações."}
        </div>
      </div>
      {!active && (
        <Button size="sm" onClick={activate} disabled={busy}>{busy ? "Ativando..." : "Ativar"}</Button>
      )}
    </Card>
  );
}
