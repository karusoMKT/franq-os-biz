import https from "node:https";

const EFI_PRODUCTION_HOST = "pix.gerencianet.com.br";

/** Certificado .p12 da Efí decodificado em memória (nunca gravado em disco) */
function certBuffer(): Buffer {
  const base64 = (process.env["EFI_CERT_BASE64"] ?? "").trim();
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
  qrcode: string;
  imagemQrcode: string;
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

  if (
    qrResponse.status >= 400 ||
    !qrResponse.data?.qrcode ||
    !qrResponse.data?.imagemQrcode
  ) {
    throw new Error(efiError(qrResponse.raw, qrResponse.data, "Falha ao gerar o QR Code Pix"));
  }

  return {
    txid: chargeResponse.data.txid,
    qrcode: qrResponse.data.qrcode,
    imagemQrcode: qrResponse.data.imagemQrcode,
  };
}
