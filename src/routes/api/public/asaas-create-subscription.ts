import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { asaasFetch, findOrCreateCustomer } from "@/lib/asaas.server";

const PLAN_VALUE = 97.0;

const bodySchema = z.object({
  name: z.string().min(2),
  cpfCnpj: z.string().min(11),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  billingType: z.enum(["PIX", "CREDIT_CARD"]),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/asaas-create-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Não autenticado" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        const user = userData?.user;
        if (userError || !user) return json({ error: "Sessão inválida" }, 401);

        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch {
          return json({ error: "Dados inválidos. Verifique nome, CPF/CNPJ e e-mail." }, 400);
        }

        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, asaas_customer_id, asaas_subscription_id")
            .eq("user_id", user.id)
            .maybeSingle();

          const customerId =
            profile?.asaas_customer_id ??
            (await findOrCreateCustomer({
              name: payload.name,
              cpfCnpj: payload.cpfCnpj,
              email: payload.email,
              mobilePhone: payload.phone ?? null,
            }));

          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + 1);

          const subscription = await asaasFetch<{ id: string }>("/subscriptions", {
            method: "POST",
            body: {
              customer: customerId,
              billingType: payload.billingType,
              value: PLAN_VALUE,
              cycle: "MONTHLY",
              nextDueDate: nextDueDate.toISOString().slice(0, 10),
              description: "FranqOS - Plano Completo",
            },
          });

          await supabaseAdmin
            .from("profiles")
            .update({
              asaas_customer_id: customerId,
              asaas_subscription_id: subscription.id,
            })
            .eq("user_id", user.id);

          // Primeira cobrança gerada pela assinatura
          const payments = await asaasFetch<{
            data?: Array<{ id: string; invoiceUrl?: string }>;
          }>(`/subscriptions/${subscription.id}/payments`);
          const payment = payments?.data?.[0];

          let pix: { payload: string; encodedImage: string } | null = null;
          if (payload.billingType === "PIX" && payment?.id) {
            try {
              const qr = await asaasFetch<{ payload: string; encodedImage: string }>(
                `/payments/${payment.id}/pixQrCode`,
              );
              if (qr?.payload) pix = { payload: qr.payload, encodedImage: qr.encodedImage };
            } catch (err) {
              console.error("[asaas] pixQrCode", err);
            }
          }

          return json({
            subscriptionId: subscription.id,
            customerId,
            paymentId: payment?.id ?? null,
            invoiceUrl: payment?.invoiceUrl ?? null,
            pix,
          });
        } catch (err) {
          console.error("[asaas-create-subscription]", err);
          return json(
            { error: err instanceof Error ? err.message : "Falha ao gerar assinatura" },
            502,
          );
        }
      },
    },
  },
});
