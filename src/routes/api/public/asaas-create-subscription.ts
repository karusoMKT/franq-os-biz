import { createFileRoute } from "@tanstack/react-router";

const PLAN_VALUE = 97.0;
const BASE_URL = "https://www.asaas.com/api/v3";

/** Remove tudo que não for dígito (CPF/CNPJ, telefone, CEP devem conter apenas números) */
const onlyNumbers = (str: unknown): string => (str ? String(str).replace(/\D/g, "") : "");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function baseUrl(): string {
  return BASE_URL;
}

async function asaas<T = any>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const key = (process.env["ASAAS_API_KEY"] ?? "").trim();
  if (!key) return { ok: false, status: 500, data: null, error: "ASAAS_API_KEY não configurada" };

  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      access_token: key,
      "Content-Type": "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }

  if (!res.ok) {
    const error =
      parsed?.errors?.[0]?.description ?? parsed?.message ?? text ?? `Erro Asaas (${res.status})`;
    return { ok: false, status: res.status, data: null, error };
  }
  return { ok: true, status: res.status, data: parsed as T, error: null };
}

function todayYYYYMMDD(): string {
  // Data atual no fuso de São Paulo
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const Route = createFileRoute("/api/public/asaas-create-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Autenticação opcional: se houver token válido, vinculamos os IDs ao perfil.
          //    A rota é pública para o checkout e nunca deve retornar 401 por falta de token.
          const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          let userId: string | null = null;
          if (token) {
            const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
            if (!userError && userData?.user) {
              userId = userData.user.id;
            }
          }

          // 2. Entrada + sanitização obrigatória
          let body: any;
          try {
            body = await request.json();
          } catch {
            return json({ success: false, error: "Corpo da requisição inválido" }, 400);
          }

          const name = String(body?.name ?? "").trim();
          const email = String(body?.email ?? "").trim();
          const paymentMethod = body?.billingType ?? body?.paymentMethod;
          const cleanCpfCnpj = onlyNumbers(body?.cpfCnpj);
          const cleanPhone = onlyNumbers(body?.phone ?? body?.mobilePhone);
          const cleanPostalCode = onlyNumbers(body?.postalCode);

          if (name.length < 2) return json({ success: false, error: "Informe o nome completo." }, 400);
          if (!/^\S+@\S+\.\S+$/.test(email)) return json({ success: false, error: "E-mail inválido." }, 400);
          if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
            return json(
              { success: false, error: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos." },
              400,
            );
          }
          if (cleanPhone && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
            return json(
              { success: false, error: "Telefone inválido. Use DDD + número." },
              400,
            );
          }
          if (cleanPostalCode && cleanPostalCode.length !== 8) {
            return json({ success: false, error: "CEP deve ter 8 dígitos." }, 400);
          }
          if (paymentMethod !== "PIX" && paymentMethod !== "CREDIT_CARD") {
            return json({ success: false, error: "Forma de pagamento inválida." }, 400);
          }

          // 3a. Criar (ou reaproveitar) o cliente no Asaas
          const { data: profile } = userId
            ? await supabaseAdmin
                .from("profiles")
                .select("id, asaas_customer_id")
                .eq("user_id", userId)
                .maybeSingle()
            : { data: null };

          let customerId = profile?.asaas_customer_id ?? null;

          if (!customerId) {
            const customer = await asaas<{ id: string }>("/customers", {
              method: "POST",
              body: {
                name,
                email,
                cpfCnpj: cleanCpfCnpj,
                ...(cleanPhone ? { mobilePhone: cleanPhone } : {}),
                ...(cleanPostalCode ? { postalCode: cleanPostalCode } : {}),
              },
            });
            if (!customer.ok || !customer.data?.id) {
              return json(
                { success: false, error: customer.error ?? "Falha ao criar cliente no Asaas" },
                400,
              );
            }
            customerId = customer.data.id;
          }

          // 3b. Criar assinatura recorrente (billingType BOLETO gera fatura com Pix)
          const subscription = await asaas<{ id: string }>("/subscriptions", {
            method: "POST",
            body: {
              customer: customerId,
              billingType: "BOLETO",
              value: PLAN_VALUE,
              nextDueDate: todayYYYYMMDD(),
              cycle: "MONTHLY",
              description: "Assinatura FranqOS - Gestão SaaS",
            },
          });
          if (!subscription.ok || !subscription.data?.id) {
            return json(
              {
                success: false,
                error: subscription.error ?? "Falha ao criar assinatura no Asaas",
              },
              400,
            );
          }
          const subscriptionId = subscription.data.id;

          // 3c. Persistir IDs no perfil (quando houver usuário autenticado)
          if (userId) {
            await supabaseAdmin
              .from("profiles")
              .update({
                asaas_customer_id: customerId,
                asaas_subscription_id: subscriptionId,
              })
              .eq("user_id", userId);
          }

          // 3d. Pausa de sincronização: o Asaas leva ~1s para registar a fatura inicial
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // 3e. Listar as faturas vinculadas à assinatura
          const payments = await asaas<{
            data?: Array<{ id: string; invoiceUrl?: string; status?: string }>;
          }>(`/subscriptions/${subscriptionId}/payments`);

          const firstPayment = payments.data?.data?.[0];
          if (!payments.ok || !firstPayment?.id) {
            console.error("[asaas] nenhuma fatura encontrada para a assinatura", {
              subscriptionId,
              error: payments.error,
            });
            return json(
              {
                success: false,
                error: "A fatura inicial ainda não está disponível. Tente novamente em instantes.",
              },
              400,
            );
          }

          const paymentId = firstPayment.id;
          const invoiceUrl = firstPayment.invoiceUrl ?? null;

          // 3f. Obter o QR Code Pix dessa fatura
          const qr = await asaas<{
            encodedImage?: string;
            payload?: string;
            expirationDate?: string;
          }>(`/payments/${paymentId}/pixQrCode`);

          if (!qr.ok || !qr.data?.encodedImage || !qr.data?.payload) {
            console.error("[asaas] pixQrCode", { paymentId, error: qr.error });
            return json(
              {
                success: false,
                error: qr.error ?? "Não foi possível gerar o QR Code Pix. Tente novamente.",
              },
              400,
            );
          }

          return json({
            success: true,
            subscriptionId,
            customerId,
            paymentId,
            invoiceUrl,
            pix: {
              encodedImage: qr.data.encodedImage,
              payload: qr.data.payload,
              expirationDate: qr.data.expirationDate ?? null,
            },
          });
        } catch (error) {
          console.error("[asaas-create-subscription] erro inesperado:", error);
          return json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Erro interno do servidor",
            },
            400,
          );
        }
      },
    },
  },
});
