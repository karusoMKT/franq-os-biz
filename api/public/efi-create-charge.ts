import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createImmediatePixCharge } from "../../src/lib/efi.server";

const PLAN_VALUE = "97.00";
const PLAN_DESCRIPTION = "Assinatura FranqOS - Gestão SaaS";

const onlyNumbers = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).replace(/\D/g, "");

function parseBody(body: unknown): Record<string, unknown> | null {
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function bearerToken(authorization: string | string[] | undefined): string {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  return (header ?? "").replace(/^Bearer\s+/i, "").trim();
}

async function markPaymentPending(token: string): Promise<void> {
  if (!token) return;

  try {
    const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (!data.user) return;

    await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "pending_payment" })
      .eq("user_id", data.user.id);
  } catch (error) {
    console.error("[vercel/efi-create-charge] falha ao atualizar perfil:", error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ success: false, error: "Corpo da requisição inválido" });
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const cpfCnpj = onlyNumbers(body.cpfCnpj);

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: "Informe o nome completo." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, error: "E-mail inválido." });
    }
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return res
        .status(400)
        .json({ success: false, error: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos." });
    }

    const pix = await createImmediatePixCharge(
      PLAN_VALUE,
      { name, cpfCnpj },
      PLAN_DESCRIPTION,
    );

    await markPaymentPending(bearerToken(req.headers.authorization));

    return res.status(200).json({
      success: true,
      qrcode: pix.qrcode,
      imagemQrcode: pix.imagemQrcode,
    });
  } catch (error) {
    console.error("[vercel/efi-create-charge] erro:", error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro interno do servidor",
    });
  }
}