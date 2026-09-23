import { createFileRoute } from "@tanstack/react-router";

const PLAN_VALUE = "97.00";

const onlyNumbers = (str: unknown): string => (str ? String(str).replace(/\D/g, "") : "");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/efi-create-charge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: any;
          try {
            body = await request.json();
          } catch {
            return json({ success: false, error: "Corpo da requisição inválido" }, 400);
          }

          const name = String(body?.name ?? "").trim();
          const email = String(body?.email ?? "").trim();
          const cpfCnpj = onlyNumbers(body?.cpfCnpj);

          if (name.length < 2) return json({ success: false, error: "Informe o nome completo." }, 400);
          if (!/^\S+@\S+\.\S+$/.test(email)) return json({ success: false, error: "E-mail inválido." }, 400);
          if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
            return json({ success: false, error: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos." }, 400);
          }

          const { createImmediatePixCharge } = await import("@/lib/efi.server");
          const pix = await createImmediatePixCharge(
            PLAN_VALUE,
            { name, cpfCnpj },
            "Assinatura FranqOS - Gestão SaaS",
          );

          // Vincula o txid ao perfil quando houver usuário autenticado
          const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (token) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data: userData } = await supabaseAdmin.auth.getUser(token);
              if (userData?.user) {
                await supabaseAdmin
                  .from("profiles")
                  .update({ subscription_status: "pending_payment" })
                  .eq("user_id", userData.user.id);
              }
            } catch (err) {
              console.error("[efi-create-charge] falha ao atualizar perfil:", err);
            }
          }

          return json({ success: true, pix });
        } catch (error) {
          console.error("[efi-create-charge] erro:", error);
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
