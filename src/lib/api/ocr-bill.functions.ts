import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
});

export type OcrBillResult = {
  supplier_name: string | null;
  amount: number | null;
  due_date: string | null;
};

export const ocrBill = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<OcrBillResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Você é um assistente financeiro. Leia este boleto ou conta de consumo e retorne estritamente um JSON válido com as seguintes chaves: 'supplier_name' (string com o nome do fornecedor/empresa), 'amount' (number, valor exato usando ponto para decimais, sem R$), 'due_date' (string, data de vencimento no formato YYYY-MM-DD). Se algum dado for ilegível, retorne null no campo.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${data.mimeType};base64,${data.imageBase64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("[ocrBill] gateway error", response.status, body);
      if (response.status === 429)
        throw new Error("Muitas requisições. Tente novamente em instantes.");
      if (response.status === 402)
        throw new Error("Créditos de IA esgotados. Recarregue para continuar.");
      throw new Error(`Falha ao ler boleto (${response.status})`);
    }

    const payload = await response.json();
    const text: string = payload?.choices?.[0]?.message?.content ?? "{}";

    let parsed: Partial<OcrBillResult> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = {};
        }
      }
    }

    return {
      supplier_name:
        typeof parsed.supplier_name === "string" ? parsed.supplier_name : null,
      amount:
        typeof parsed.amount === "number"
          ? parsed.amount
          : parsed.amount != null && !isNaN(Number(parsed.amount))
            ? Number(parsed.amount)
            : null,
      due_date:
        typeof parsed.due_date === "string" ? parsed.due_date : null,
    };
  });
