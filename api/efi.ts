import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import https from "node:https";

const EFI_BASE_URL = "https://pix.gerencianet.com.br";
const PLAN_VALUE = "97.00";
const PLAN_DESCRIPTION = "Assinatura FranqOS - Gestão SaaS";

type EfiStep = "autenticacao" | "criacao_cobranca" | "geracao_qrcode";

class EfiStepError extends Error {
  step: EfiStep;
  details: unknown;

  constructor(step: EfiStep, error: unknown) {
    const message = axios.isAxiosError(error)
      ? extractEfiMessage(error.response?.data, error.message)
      : error instanceof Error
        ? error.message
        : String(error);

    super(message);
    this.name = "EfiStepError";
    this.step = step;
    this.details = axios.isAxiosError(error) ? (error.response?.data ?? null) : null;
  }
}

function extractEfiMessage(details: unknown, fallback: string): string {
  if (!details || typeof details !== "object") return fallback;
  const data = details as Record<string, unknown>;
  const message = data.mensagem ?? data.error_description ?? data.nome ?? data.detail;
  return typeof message === "string" ? message : fallback;
}

function createMtlsAgent(): https.Agent {
  const certBase64 = (process.env.EFI_CERT_BASE64 ?? "").replace(/[\r\n\s]/g, "");
  if (!certBase64) throw new Error("EFI_CERT_BASE64 não configurada");

  const certBuffer = Buffer.from(certBase64, "base64");
  if (certBuffer.length === 0) throw new Error("EFI_CERT_BASE64 inválida");

  return new https.Agent({
    pfx: certBuffer,
    passphrase: "",
  });
}

interface TokenResponse {
  access_token?: string;
}

interface ChargeResponse {
  txid?: string;
  loc?: { id?: number };
}

interface QrCodeResponse {
  qrcode?: string;
  imagemQrcode?: string;
}

async function authenticate(agent: https.Agent): Promise<string> {
  try {
    const clientId = (process.env.EFI_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.EFI_CLIENT_SECRET ?? "").trim();
    if (!clientId || !clientSecret) {
      throw new Error("EFI_CLIENT_ID/EFI_CLIENT_SECRET não configuradas");
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await axios.post<TokenResponse>(
      `${EFI_BASE_URL}/oauth/token`,
      { grant_type: "client_credentials" },
      {
        httpsAgent: agent,
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.data.access_token) throw new Error("Token da Efí não retornado");
    return response.data.access_token;
  } catch (error) {
    if (error instanceof EfiStepError) throw error;
    throw new EfiStepError("autenticacao", error);
  }
}

async function createCharge(
  agent: https.Agent,
  token: string,
  payer: { name: string; cpfCnpj: string },
): Promise<{ txid: string; locId: number }> {
  try {
    const pixKey = (process.env.EFI_PIX_KEY ?? "").trim();
    if (!pixKey) throw new Error("EFI_PIX_KEY não configurada");

    const digits = payer.cpfCnpj.replace(/\D/g, "");
    const devedor =
      digits.length === 14
        ? { cnpj: digits, nome: payer.name }
        : { cpf: digits, nome: payer.name };

    const response = await axios.post<ChargeResponse>(
      `${EFI_BASE_URL}/v2/cob`,
      {
        calendario: { expiracao: 3600 },
        devedor,
        valor: { original: PLAN_VALUE },
        chave: pixKey,
        solicitacaoPagador: PLAN_DESCRIPTION,
      },
      {
        httpsAgent: agent,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const locId = response.data.loc?.id;
    const txid = response.data.txid;
    if (!locId || !txid) throw new Error("Resposta da cobrança Pix incompleta");

    return { txid, locId };
  } catch (error) {
    if (error instanceof EfiStepError) throw error;
    throw new EfiStepError("criacao_cobranca", error);
  }
}

async function generateQrCode(
  agent: https.Agent,
  token: string,
  locId: number,
): Promise<{ qrcode: string; imagemQrcode: string }> {
  try {
    const response = await axios.get<QrCodeResponse>(
      `${EFI_BASE_URL}/v2/loc/${encodeURIComponent(String(locId))}/qrcode`,
      {
        httpsAgent: agent,
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const { qrcode, imagemQrcode } = response.data;
    if (!qrcode || !imagemQrcode) throw new Error("Resposta do QR Code Pix incompleta");

    return { qrcode, imagemQrcode };
  } catch (error) {
    if (error instanceof EfiStepError) throw error;
    throw new EfiStepError("geracao_qrcode", error);
  }
}

function bearerToken(authorization: string | string[] | undefined): string {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  return (header ?? "").replace(/^Bearer\s+/i, "").trim();
}

async function markPaymentPending(token: string): Promise<void> {
  if (!token) return;

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
    });
    if (!userResponse.ok) return;

    const user: unknown = await userResponse.json();
    if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string") return;

    await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ subscription_status: "pending_payment" }),
    });
  } catch (error) {
    console.error("[vercel/efi] falha ao atualizar perfil:", error);
  }
}

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

    const agent = createMtlsAgent();
    const token = await authenticate(agent);
    const charge = await createCharge(agent, token, { name, cpfCnpj });
    const qrCode = await generateQrCode(agent, token, charge.locId);

    await markPaymentPending(bearerToken(req.headers.authorization));

    return res.status(200).json({
      success: true,
      qrcode: qrCode.qrcode,
      imagemQrcode: qrCode.imagemQrcode,
      txid: charge.txid,
    });
  } catch (error) {
    console.error("[vercel/efi] erro:", error);
    if (error instanceof EfiStepError) {
      return res.status(400).json({
        success: false,
        step: error.step,
        error: error.message,
        details: error.details,
      });
    }

    return res.status(400).json({
      success: false,
      step: "validacao",
      error: error instanceof Error ? error.message : "Erro interno do servidor",
      details: null,
    });
  }
}