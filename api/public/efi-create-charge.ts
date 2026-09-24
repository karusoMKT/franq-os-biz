import type { VercelRequest, VercelResponse } from "@vercel/node";
import https from "node:https";

// ============= Efí Bank (Gerencianet) — lógica Pix consolidada =============
// Tudo embutido neste arquivo: nenhuma importação de fora da pasta /api,
// garantindo que o bundle da Vercel encontre todos os módulos.

const EFI_PRODUCTION_HOST = "pix.gerencianet.com.br";
const PLAN_VALUE = "97.00";
const PLAN_DESCRIPTION = "Assinatura FranqOS - Gestão SaaS";

/** Certificado .p12 da Efí decodificado em memória (nunca gravado em disco) */
function certBuffer(): Buffer {
  const base64 = (process.env.EFI_CERT_BASE64 ?? "").trim();
  if (!base64) throw new Error("EFI_CERT_BASE64 não configurada");
  return Buffer.from(base64, "base64");
}

interface EfiRequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Requisição mTLS para a API Pix da Efí */
function efiRequest<T = unknown>(
  opts: EfiRequestOptions,
): Promise<{ status: number; data: T | null; raw: string }> {
  const payload = opts.body === undefined ? null : JSON.stringify(opts.body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: EFI_PRODUCTION_HOST,
        port: 443,
        method: opts.method,
        path: opts.path,
        pfx: certBuffer(),
        passphrase: "",
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
          ...(opts.headers ?? {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let data: any = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            /* resposta não-JSON */
          }
          resolve({ status: res.statusCode ?? 500, data, raw });
        });
      },
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function efiError(raw: string, data: any, fallback: string): string {
  return (
    data?.mensagem ??
    data?.error_description ??
    data?.nome ??
    data?.detail ??
    (raw ? raw.slice(0, 300) : fallback)
  );
}

/** OAuth2 client_credentials — {host}/oauth/token */
async function getEfiAccessToken(): Promise<string> {
  const clientId = (process.env.EFI_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.EFI_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret)
    throw new Error("EFI_CLIENT_ID/EFI_CLIENT_SECRET não configuradas");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await efiRequest<{ access_token?: string }>({
    method: "POST",
    path: "/oauth/token",
    body: { grant_type: "client_credentials" },
    headers: { Authorization: `Basic ${basic}` },
  });

  if (res.status >= 400 || !res.data?.access_token) {
    throw new Error(efiError(res.raw, res.data, "Falha na autenticação com a Efí"));
  }
  return res.data.access_token;
}

interface EfiPixCharge {
  txid: string;
  qrcode: string;
  imagemQrcode: string;
}

/** Cria uma cobrança Pix imediata e devolve o QR Code + copia e cola */
async function createImmediatePixCharge(
  valor: string,
  payer: { name: string; cpfCnpj: string },
  description: string,
): Promise<EfiPixCharge> {
  const token = await getEfiAccessToken();
  const authHeader = { Authorization: `Bearer ${token}` };
  const pixKey = (process.env.EFI_PIX_KEY ?? "").trim();
  if (!pixKey) throw new Error("EFI_PIX_KEY não configurada");

  const digits = payer.cpfCnpj.replace(/\D/g, "");
  const devedor =
    digits.length === 14
      ? { cnpj: digits, nome: payer.name }
      : { cpf: digits, nome: payer.name };

  // Passo 1: cria a cobrança. Nunca usamos a propriedade loc.location.
  const chargeResponse = await efiRequest<{ txid?: string; loc?: { id?: number } }>({
    method: "POST",
    path: "/v2/cob",
    headers: authHeader,
    body: {
      calendario: { expiracao: 3600 },
      devedor,
      valor: { original: valor },
      chave: pixKey,
      solicitacaoPagador: description,
    },
  });

  const locId = chargeResponse.data?.loc?.id;
  if (chargeResponse.status >= 400 || !chargeResponse.data?.txid || !locId) {
    throw new Error(
      efiError(chargeResponse.raw, chargeResponse.data, "Falha ao criar a cobrança Pix"),
    );
  }

  // Passo 2: o QR Code é obtido obrigatoriamente via GET usando somente loc.id.
  const qrResponse = await efiRequest<{ qrcode?: string; imagemQrcode?: string }>({
    method: "GET",
    path: `/v2/loc/${locId}/qrcode`,
    headers: authHeader,
  });

  if (!qrResponse.data?.qrcode || !qrResponse.data?.imagemQrcode) {
    throw new Error(efiError(qrResponse.raw, qrResponse.data, "Falha ao gerar o QR Code Pix"));
  }

  return {
    txid: chargeResponse.data.txid,
    qrcode: qrResponse.data.qrcode,
    imagemQrcode: qrResponse.data.imagemQrcode,
  };
}

// ============= Supabase (via REST puro, sem imports externos) =============

function bearerToken(authorization: string | string[] | undefined): string {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  return (header ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Marca o perfil do usuário autenticado como pending_payment (via REST do Supabase) */
async function markPaymentPending(token: string): Promise<void> {
  if (!token) return;

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
    });
    if (!userRes.ok) return;
    const user: any = await userRes.json();
    if (!user?.id) return;

    await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${user.id}`, {
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
    console.error("[vercel/efi-create-charge] falha ao atualizar perfil:", error);
  }
}

// ============= Handler Vercel =============

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

    const pix = await createImmediatePixCharge(PLAN_VALUE, { name, cpfCnpj }, PLAN_DESCRIPTION);

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
