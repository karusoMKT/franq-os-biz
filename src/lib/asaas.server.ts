const DEFAULT_BASE = "https://api.asaas.com/v3";

export function asaasBaseUrl(): string {
  return (process.env["ASAAS_API_URL"] ?? DEFAULT_BASE).replace(/\/$/, "");
}

export async function asaasFetch<T = any>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const key = process.env["ASAAS_API_KEY"];
  if (!key) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${asaasBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      access_token: key.trim(),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }

  if (!res.ok) {
    const message =
      json?.errors?.[0]?.description ?? json?.message ?? text ?? `Erro Asaas (${res.status})`;
    throw new Error(message);
  }

  return json as T;
}

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string | null;
  mobilePhone?: string | null;
}

export async function findOrCreateCustomer(input: AsaasCustomerInput): Promise<string> {
  const cpfCnpj = input.cpfCnpj.replace(/\D/g, "");
  const existing = await asaasFetch<{ data?: Array<{ id: string }> }>(
    `/customers?cpfCnpj=${cpfCnpj}`,
  );
  if (existing?.data?.length) return existing.data[0]!.id;

  const created = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: {
      name: input.name,
      cpfCnpj,
      email: input.email ?? undefined,
      mobilePhone: input.mobilePhone ? input.mobilePhone.replace(/\D/g, "") : undefined,
      notificationDisabled: false,
    },
  });
  return created.id;
}
