import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Webhook do assistente financeiro no WhatsApp.
// URL pública: /api/public/whatsapp-webhook (o prefixo /api/public ignora o
// login do app publicado — a autenticação é feita aqui via WHATSAPP_WEBHOOK_TOKEN).

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  from: z.string().max(64).optional(),
  company_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
});

// Payload padrão da Cloud API da Meta (opcional)
function extractMetaMessage(payload: unknown): { message: string; from?: string } | null {
  try {
    const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    const text = msg?.text?.body;
    if (typeof text === "string" && text.trim()) {
      return { message: text.trim(), from: msg?.from };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      // Verificação do webhook (Meta Cloud API)
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token =
          process.env["WEBHOOK_VERIFY_TOKEN"] ?? process.env["WHATSAPP_VERIFY_TOKEN"];
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          token &&
          url.searchParams.get("hub.verify_token") === token
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const authToken = process.env["WHATSAPP_WEBHOOK_TOKEN"];
        if (authToken) {
          const header =
            request.headers.get("x-webhook-token") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            "";
          if (header !== authToken) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        const meta = extractMetaMessage(raw);
        const parsed = BodySchema.safeParse(
          meta ? { ...(raw as object), ...meta } : raw,
        );
        if (!parsed.success) {
          return Response.json({ error: "Payload inválido" }, { status: 400 });
        }

        try {
          const { handleWhatsappMessage } = await import("@/lib/whatsapp-assistant.server");
          const result = await handleWhatsappMessage({
            message: parsed.data.message,
            company_id: parsed.data.company_id,
            unit_id: parsed.data.unit_id,
          });
          return Response.json({
            intent: result.intent,
            reply: result.reply,
            data: result.data,
          });
        } catch (error) {
          console.error("[whatsapp-webhook]", error);
          return Response.json(
            {
              intent: "GENERAL_CHAT",
              reply:
                "Tive um problema para processar sua mensagem agora. Tente novamente em instantes.",
            },
            { status: 200 },
          );
        }
      },
    },
  },
});
