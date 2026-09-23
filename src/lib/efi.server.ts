import https from "node:https";

/** Produção: pix.efipay.com.br | Sandbox: pix-h.efipay.com.br */
function efiHost(): string {
  const sandbox = (process.env["EFI_SANDBOX"] ?? "").trim().toLowerCase();
  const isSandbox = sandbox === "true" || sandbox === "1";
  const fallback = isSandbox ? "pix-h.efipay.com.br" : "pix.efipay.com.br";

  const raw = (process.env["EFI_BASE_URL"] ?? "").trim();
  if (!raw) return fallback;

  // Sanitiza: remove protocolo duplicado/ausente e barras finais, evitando "https://https://..."
  const cleaned = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "").trim();
  if (!cleaned) return fallback;
  return cleaned;
}

/** Certificado .p12 da Efí decodificado em memória (nunca gravado em disco) */
function certBuffer(): Buffer {
  const base64 = (process.env["EFI_CERT_BASE64"] ?? "").trim();
  if (!base64) throw new Error("EFI_CERT_BASE64 não configurada");
  return Buffer.from(base64, "base64");
}

interface EfiRequestOptions {
  method?: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Requisição mTLS para a API Pix da Efí */
function efiRequest<T = any>(opts: EfiRequestOptions): Promise<{ status: number; data: T | null; raw: string }> {
  const payload = opts.body ? JSON.stringify(opts.body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: EFI_HOST,
        port: 443,
        method: opts.method ?? "GET",
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

/** OAuth2 client_credentials — https://pix.efipay.com.br/oauth/token */
export async function getEfiAccessToken(): Promise<string> {
  const clientId = (process.env["EFI_CLIENT_ID"] ?? "").trim();
  const clientSecret = (process.env["EFI_CLIENT_SECRET"] ?? "").trim();
  if (!clientId || !clientSecret) throw new Error("EFI_CLIENT_ID/EFI_CLIENT_SECRET não configuradas");

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

export interface EfiPixPayer {
  name: string;
  cpfCnpj: string;
}

export interface EfiPixCharge {
  txid: string;
  encodedImage: string;
  payload: string;
}

/** Cria uma cobrança Pix imediata e devolve o QR Code + copia e cola */
export async function createImmediatePixCharge(
  valor: string,
  payer: EfiPixPayer,
  description: string,
): Promise<EfiPixCharge> {
  const token = await getEfiAccessToken();
  const authHeader = { Authorization: `Bearer ${token}` };
  const pixKey = (process.env["EFI_PIX_KEY"] ?? "").trim();
  if (!pixKey) throw new Error("EFI_PIX_KEY não configurada");

  const digits = payer.cpfCnpj.replace(/\D/g, "");
  const devedor =
    digits.length === 14
      ? { cnpj: digits, nome: payer.name }
      : { cpf: digits, nome: payer.name };

  const cob = await efiRequest<{ txid?: string; loc?: { id?: number } }>({
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

  if (cob.status >= 400 || !cob.data?.txid || !cob.data?.loc?.id) {
    throw new Error(efiError(cob.raw, cob.data, "Falha ao criar a cobrança Pix"));
  }

  const qr = await efiRequest<{ qrcode?: string; imagemQrcode?: string }>({
    method: "GET",
    path: `/v2/loc/${cob.data.loc.id}/qrcode`,
    headers: authHeader,
  });

  if (qr.status >= 400 || !qr.data?.qrcode || !qr.data?.imagemQrcode) {
    throw new Error(efiError(qr.raw, qr.data, "Falha ao gerar o QR Code Pix"));
  }

  return {
    txid: cob.data.txid,
    encodedImage: qr.data.imagemQrcode,
    payload: qr.data.qrcode,
  };
}
