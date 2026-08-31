import { createFileRoute } from "@tanstack/react-router";

const STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_RECEIVED: "active",
  PAYMENT_CONFIRMED: "active",
  PAYMENT_OVERDUE: "overdue",
  SUBSCRIPTION_DELETED: "canceled",
  PAYMENT_DELETED: "canceled",
  PAYMENT_REFUNDED: "canceled",
};

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const expectedToken = process.env["ASAAS_WEBHOOK_TOKEN"]?.trim();
          if (expectedToken) {
            const received = (request.headers.get("asaas-access-token") ?? "").trim();
            if (received !== expectedToken) {
              return new Response("Forbidden", { status: 403 });
            }
          }

          const body = (await request.json()) as {
            event?: string;
            payment?: { customer?: string; subscription?: string };
            subscription?: { id?: string; customer?: string };
          };

          const event = body.event ?? "";
          const status = STATUS_BY_EVENT[event];
          if (!status) return new Response("ok", { status: 200 });

          const subscriptionId = body.payment?.subscription ?? body.subscription?.id ?? null;
          const customerId = body.payment?.customer ?? body.subscription?.customer ?? null;

          if (!subscriptionId && !customerId) return new Response("ok", { status: 200 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const query = supabaseAdmin.from("profiles").update({ subscription_status: status });
          const { error } = subscriptionId
            ? await query.eq("asaas_subscription_id", subscriptionId)
            : await query.eq("asaas_customer_id", customerId!);

          if (error) console.error("[asaas-webhook] update error", error);
        } catch (err) {
          console.error("[asaas-webhook]", err);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
