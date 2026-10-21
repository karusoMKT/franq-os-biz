import { afterEach, describe, expect, mock, test } from "bun:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const calls: Array<Record<string, any>> = [];
const txid = "FranqOSPayment1234567890123456";
let confirmed = false;
let received = "97.00";
const axiosMock = Object.assign(async (config: Record<string, any>) => {
  calls.push(config);
  if (config.url.endsWith("/oauth/token")) return { data: { access_token: "fixture-token" } };
  if (config.url.endsWith("/v2/cob")) return { data: { txid, loc: { id: 123 } } };
  if (config.url.endsWith("/qrcode")) return { data: { qrcode: "fixture-payload", imagemQrcode: "fixture-image" } };
  return { data: { txid, status: "CONCLUIDA", valor: { original: "97.00" }, pix: [{ valor: received }] } };
}, { isAxiosError: () => false });
mock.module("axios", () => ({ default: axiosMock }));
const { default: handler, createMtlsAgent, verifyAndConfirmPayment } = await import("./efi");
const originalFetch = globalThis.fetch;
const names = ["EFI_CERT_BASE64", "EFI_CLIENT_ID", "EFI_CLIENT_SECRET", "EFI_PIX_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const originalEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));

function setup() {
  calls.length = 0; confirmed = false; received = "97.00";
  process.env.EFI_CERT_BASE64 = Buffer.from("fixture-cert").toString("base64");
  process.env.EFI_CLIENT_ID = "fixture-id";
  process.env.EFI_CLIENT_SECRET = "fixture-secret";
  process.env.EFI_PIX_KEY = "fixture-pix";
  process.env.SUPABASE_URL = "https://fixture.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fixture";
  globalThis.fetch = mock(async (input, init) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id: "user-a" });
    if (url.includes("/profiles?")) return Response.json([{ company_id: "company-a" }]);
    if (url.includes("/companies?")) return Response.json([{ id: "company-a" }]);
    if (url.includes("confirm_company_efi_charge")) confirmed = true;
    return Response.json(null);
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

async function request(companyId = "company-a") {
  let status = 0;
  let result: any;
  const response = { setHeader: () => {}, status: (code: number) => { status = code; return response; }, json: (data: unknown) => { result = data; return response; } };
  await handler({ method: "POST", headers: { authorization: "Bearer fixture-session" }, body: { name: "Fixture User", email: "fixture@example.invalid", cpfCnpj: "12345678901", company_id: companyId } } as VercelRequest, response as unknown as VercelResponse);
  return { status, result };
}

describe("company payment isolation", () => {
  test("charge metadata stores the authenticated company and preserves POST POST GET with mTLS", async () => {
    setup();
    const { status } = await request();
    expect(status).toBe(200);
    expect(calls.map(call => call.method)).toEqual(["POST", "POST", "GET"]);
    expect(calls[1].data.infoAdicionais).toEqual([{ nome: "company_id", valor: "company-a" }]);
    expect(calls[1].data.valor.original).toBe("97.00");
    expect(calls.every(call => call.httpsAgent === calls[0].httpsAgent)).toBe(true);
    expect(calls[2].data).toBeUndefined();
  });
  test("another organization cannot be substituted by the browser", async () => {
    setup();
    expect((await request("company-b")).status).toBe(403);
    expect(calls.length).toBe(0);
  });
  test("a provider-confirmed 97 real payment activates its stored company", async () => {
    setup();
    expect(await verifyAndConfirmPayment(txid, createMtlsAgent(), "fixture-token")).toBe(true);
    expect(confirmed).toBe(true);
  });
  test("a smaller payment cannot activate the company", async () => {
    setup(); received = "1.00";
    expect(await verifyAndConfirmPayment(txid, createMtlsAgent(), "fixture-token")).toBe(false);
    expect(confirmed).toBe(false);
  });
});