import { createFileRoute } from "@tanstack/react-router";

const STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_RECEIVED: "active",
  PAYMENT_CONFIRMED: "active",
  PAYMENT_OVERDUE: "overdue",
  SUBSCRIPTION_DELETED: "canceled",
  PAYMENT_DELETED: "canceled",
  PAYMENT_REFUNDED: "canceled",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Verificação opcional do token de acesso do Asaas
          const expectedToken = process.env["ASAAS_WEBHOOK_TOKEN"]?.trim();
          if (expectedToken) {
            const received = (request.headers.get("asaas-access-token") ?? "").trim();
            if (received !== expectedToken) {
              return jsonResponse({ received: true, error: "Forbidden" }, 403);
            }
          }

          // 2. Parse do body com tipagem defensiva
          let body: Record<string, any>;
          try {
            body = await request.json();
          } catch {
            return jsonResponse({ received: true, error: "Invalid JSON" }, 200);
          }

          const event = String(body?.event ?? "");
          const status = STATUS_BY_EVENT[event];

          // 3. Ignorar eventos não mapeados, mas sempre retornar 200
          if (!status) {
            return jsonResponse({ received: true }, 200);
          }

          // 4. Identificar cliente pela assinatura ou pelo customer id
          const payment = body?.payment ?? {};
          const subscription = body?.subscription ?? {};

          const subscriptionId =
            payment?.subscription ?? subscription?.id ?? null;
          const customerId =
            payment?.customer ?? subscription?.customer ?? null;

          if (!subscriptionId && !customerId) {
            return jsonResponse({ received: true }, 200);
          }

          // 5. Atualizar perfil no Supabase
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let query = supabaseAdmin.from("profiles").update({ subscription_status: status });

          if (subscriptionId) {
            query = query.eq("asaas_subscription_id", subscriptionId);
          } else {
            query = query.eq("asaas_customer_id", customerId);
          }

          const { error } = await query;

          if (error) {
            console.error("[asaas-webhook] update error", error);
          } else {
            console.log("[asaas-webhook] profile updated", {
              event,
              status,
              subscriptionId,
              customerId,
            });
          }
        } catch (err) {
          console.error("[asaas-webhook] unhandled error", err);
        }

        // 6. Sempre retornar 200 OK para o Asaas não reenviar o webhook
        return jsonResponse({ received: true }, 200);
      },
    },
  },
});
